"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type { Project, ProjectQueryFilters } from "@/lib/api";
import { discoverProjectsClient, buildFindPageHref } from "@/lib/discover-client";
import type { PipelineCounts } from "@/components/find-status-filters";
import { readPersistedDiscoverQuery } from "@/lib/find-discover-query";
import { pipelineSortRank, pipelineStatus } from "@/lib/project-status";
import { useAuthUser } from "@/lib/use-auth-user";
import {
  readPollIntervalSec,
  writePollIntervalSec,
  readAutoRefreshEnabled,
  writeAutoRefreshEnabled,
  DEFAULT_POLL_SEC,
  pollIntervalMs,
} from "@/lib/discover-poll";
import {
  canShowDesktopNotifications,
  getNotificationPermissionState,
  notifyNewProjectsDiscovered,
  readDesktopNotificationsEnabled,
  requestDesktopNotificationPermission,
  writeDesktopNotificationsEnabled,
  type NotificationPermissionState,
} from "@/lib/discover-notifications";

function mergeLocallySeenProjects(
  projects: Project[],
  seenLocally: Set<string>,
): { projects: Project[]; unseenAdjust: number } {
  let unseenAdjust = 0;
  const merged = projects.map((project) => {
    if (seenLocally.has(project.id)) {
      if (project.status === "new") {
        unseenAdjust += 1;
        return { ...project, status: "viewed" };
      }
      seenLocally.delete(project.id);
    }
    return project;
  });
  return { projects: merged, unseenAdjust };
}

function mergePreservedStatuses(prev: Project[], next: Project[]): Project[] {
  const prevById = new Map(prev.map((project) => [project.id, project]));
  return next.map((project) => {
    const previous = prevById.get(project.id);
    if (!previous) return project;
    if (pipelineSortRank(previous.status) > pipelineSortRank(project.status)) {
      return { ...project, status: previous.status };
    }
    return project;
  });
}

type DiscoverMode = "full" | "incremental" | "local" | "rate_limited" | "throttled";

type MonitorState = {
  projects: Project[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  fetched: number;
  newCount: number;
  unseen: number;
  pipelineCounts: PipelineCounts;
  mode: DiscoverMode;
  error: string | null;
  loading: boolean;
  polling: boolean;
  lastCheckedAt: Date | null;
};

type RefreshOptions = {
  filters?: ProjectQueryFilters & { page?: number; pipeline?: string };
  forceFull?: boolean;
  silent?: boolean;
  localOnly?: boolean;
};

type DiscoverMonitorContextValue = {
  state: MonitorState;
  unreadNew: number;
  recentPollNew: number;
  pollIntervalSec: number;
  setPollIntervalSec: (sec: number) => void;
  autoRefreshEnabled: boolean;
  setAutoRefreshEnabled: (enabled: boolean) => void;
  desktopNotificationsEnabled: boolean;
  setDesktopNotificationsEnabled: (enabled: boolean) => Promise<void>;
  notificationPermission: NotificationPermissionState;
  refresh: (options?: RefreshOptions) => Promise<void>;
  refreshList: (options?: RefreshOptions) => Promise<void>;
  refreshForList: (listKey: string, options?: RefreshOptions) => Promise<void>;
  setActiveFilters: (filters: ProjectQueryFilters) => void;
  clearUnread: () => void;
  dismissRecentPollNew: () => void;
  markProjectSeen: (projectId: string) => void;
  confirmProjectSeenOnServer: (projectId: string) => void;
  removeProject: (projectId: string) => void;
  setProjectStatus: (projectId: string, status: "viewed" | "submitted") => void;
};

const emptyPipelineCounts: PipelineCounts = { all: 0, new: 0, seen: 0, submitted: 0 };

const emptyState: MonitorState = {
  projects: [],
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 1,
  fetched: 0,
  newCount: 0,
  unseen: 0,
  pipelineCounts: emptyPipelineCounts,
  mode: "incremental",
  error: null,
  loading: false,
  polling: false,
  lastCheckedAt: null,
};

const DiscoverMonitorContext = createContext<DiscoverMonitorContextValue | null>(null);

export function DiscoverMonitorProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const onFindPage = pathname === "/find" || pathname.startsWith("/find/");
  const filtersRef = useRef(readPersistedDiscoverQuery());
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshInFlightRef = useRef(false);
  const pendingListRefreshRef = useRef<RefreshOptions | null>(null);
  const seenLocallyRef = useRef(new Set<string>());
  const lastListKeyRef = useRef<string | null>(null);

  const [state, setState] = useState<MonitorState>(emptyState);
  const [unreadNew, setUnreadNew] = useState(0);
  const [recentPollNew, setRecentPollNew] = useState(0);
  const [pollIntervalSec, setPollIntervalSecState] = useState(DEFAULT_POLL_SEC);
  const [autoRefreshEnabled, setAutoRefreshEnabledState] = useState(true);
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabledState] = useState(true);
  const [notificationPermission, setNotificationPermissionState] =
    useState<NotificationPermissionState>("default");
  const { userId, isDevMode, loading: authLoading } = useAuthUser();
  const sessionKey = isDevMode ? "dev" : userId;
  const activeSessionRef = useRef<string | null>(null);
  const notificationPermissionRequestedRef = useRef(false);

  const resetMonitorState = useCallback(() => {
    seenLocallyRef.current.clear();
    lastListKeyRef.current = null;
    setState(emptyState);
    setUnreadNew(0);
    setRecentPollNew(0);
  }, []);

  useEffect(() => {
    if (authLoading || sessionKey === null) return;
    if (activeSessionRef.current === null) {
      activeSessionRef.current = sessionKey;
      return;
    }
    if (activeSessionRef.current !== sessionKey) {
      activeSessionRef.current = sessionKey;
      resetMonitorState();
    }
  }, [authLoading, sessionKey, resetMonitorState]);

  useEffect(() => {
    setPollIntervalSecState(readPollIntervalSec());
    setAutoRefreshEnabledState(readAutoRefreshEnabled());
    setDesktopNotificationsEnabledState(readDesktopNotificationsEnabled());
    setNotificationPermissionState(getNotificationPermissionState());
  }, []);

  useEffect(() => {
    if (!onFindPage || notificationPermissionRequestedRef.current) return;
    if (!readDesktopNotificationsEnabled()) return;
    if (getNotificationPermissionState() !== "default") return;
    notificationPermissionRequestedRef.current = true;
    void requestDesktopNotificationPermission().then(setNotificationPermissionState);
  }, [onFindPage]);

  const setPollIntervalSec = useCallback((sec: number) => {
    setPollIntervalSecState(writePollIntervalSec(sec));
  }, []);

  const setAutoRefreshEnabled = useCallback((enabled: boolean) => {
    setAutoRefreshEnabledState(writeAutoRefreshEnabled(enabled));
  }, []);

  const setDesktopNotificationsEnabled = useCallback(async (enabled: boolean) => {
    setDesktopNotificationsEnabledState(writeDesktopNotificationsEnabled(enabled));
    if (!enabled) return;
    const permission = await requestDesktopNotificationPermission();
    setNotificationPermissionState(permission);
  }, []);

  const refresh = useCallback(async (options: RefreshOptions = {}) => {
    const silent = options.silent ?? false;
    const localOnly = options.localOnly ?? false;

    if (refreshInFlightRef.current) {
      if (localOnly) {
        pendingListRefreshRef.current = options;
      }
      return;
    }
    refreshInFlightRef.current = true;

    const filters = options.filters ?? filtersRef.current;
    const forceFull = options.forceFull ?? false;

    setState((prev) => ({
      ...prev,
      loading: silent ? prev.loading : true,
      polling: silent,
      error: silent ? prev.error : null,
    }));

    try {
      const result = await discoverProjectsClient(filters, { forceFull, localOnly });
      const { projects: mergedLocal, unseenAdjust } = mergeLocallySeenProjects(
        result.projects,
        seenLocallyRef.current,
      );
      let hadPriorList = false;
      setState((prev) => {
        hadPriorList = prev.projects.length > 0;
        const nextPage = result.page ?? prev.page;
        const samePage = nextPage === prev.page;
        const discoverMessage = result.throttled
          ? null
          : result.discover_message ||
            (result.rate_limited
              ? "Freelancer rate limit — showing saved projects."
              : null);
        return {
          ...prev,
          projects:
            options.silent && samePage
              ? mergePreservedStatuses(prev.projects, mergedLocal)
              : mergedLocal,
          total: result.total,
          page: nextPage,
          pageSize: result.page_size ?? prev.pageSize,
          totalPages: result.total_pages ?? prev.totalPages,
          fetched: result.fetched,
          newCount: result.new,
          unseen: Math.max(0, (result.unseen ?? 0) - unseenAdjust),
          pipelineCounts: result.pipeline_counts ?? prev.pipelineCounts,
          mode: result.mode,
          error: discoverMessage,
          lastCheckedAt: new Date(),
        };
      });

      const newMatchingCount = result.new_matching ?? 0;
      const matchingNewTitles = result.new_matching_titles ?? [];

      // Alert only when newly discovered projects match the active Find filters.
      if (!localOnly && newMatchingCount > 0 && hadPriorList) {
        if (onFindPage) {
          if (silent) setRecentPollNew(newMatchingCount);
          setUnreadNew(0);
        } else {
          setUnreadNew((n) => n + newMatchingCount);
        }

        if (canShowDesktopNotifications()) {
          notifyNewProjectsDiscovered({
            count: newMatchingCount,
            titles: matchingNewTitles,
            findUrl: buildFindPageHref(filters),
          });
        }
      }

      if (!localOnly && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("bidautomation:projects-updated"));
      }
    } catch (e) {
      if (!silent) {
        setState((prev) => ({
          ...prev,
          error: e instanceof Error ? e.message : "Could not reach API",
        }));
      }
    } finally {
      refreshInFlightRef.current = false;
      setState((prev) => ({ ...prev, loading: false, polling: false }));
      const pending = pendingListRefreshRef.current;
      if (pending) {
        pendingListRefreshRef.current = null;
        void refresh(pending);
      }
    }
  }, [onFindPage]);

  const refreshList = useCallback(
    async (options: RefreshOptions = {}) => {
      await refresh({
        ...options,
        localOnly: true,
        forceFull: false,
      });
    },
    [refresh],
  );

  const refreshForList = useCallback(
    async (listKey: string, options: RefreshOptions = {}) => {
      if (lastListKeyRef.current === listKey) return;
      lastListKeyRef.current = listKey;
      await refreshList(options);
    },
    [refreshList],
  );

  const setActiveFilters = useCallback((filters: ProjectQueryFilters) => {
    filtersRef.current = filters;
  }, []);

  const clearUnread = useCallback(() => {
    setUnreadNew(0);
  }, []);

  const dismissRecentPollNew = useCallback(() => {
    setRecentPollNew(0);
  }, []);

  const markProjectSeen = useCallback((projectId: string) => {
    seenLocallyRef.current.add(projectId);
    setState((prev) => {
      const index = prev.projects.findIndex((p) => p.id === projectId);
      if (index === -1) return prev;
      const project = prev.projects[index];
      if (project.status !== "new") return prev;

      const projects = [...prev.projects];
      projects[index] = { ...project, status: "viewed" };
      return {
        ...prev,
        projects,
        unseen: Math.max(0, prev.unseen - 1),
      };
    });
  }, []);

  const confirmProjectSeenOnServer = useCallback((projectId: string) => {
    seenLocallyRef.current.delete(projectId);
  }, []);

  const removeProject = useCallback((projectId: string) => {
    seenLocallyRef.current.delete(projectId);
    setState((prev) => {
      const index = prev.projects.findIndex((p) => p.id === projectId);
      if (index === -1) return prev;
      const removed = prev.projects[index];
      const projects = prev.projects.filter((p) => p.id !== projectId);
      const wasNew = removed.status === "new";
      const pipelineCounts = { ...prev.pipelineCounts };
      pipelineCounts.all = Math.max(0, pipelineCounts.all - 1);
      if (wasNew) {
        pipelineCounts.new = Math.max(0, pipelineCounts.new - 1);
      } else if (removed.status === "submitted") {
        pipelineCounts.submitted = Math.max(0, pipelineCounts.submitted - 1);
      } else {
        pipelineCounts.seen = Math.max(0, pipelineCounts.seen - 1);
      }
      return {
        ...prev,
        projects,
        total: Math.max(0, prev.total - 1),
        unseen: wasNew ? Math.max(0, prev.unseen - 1) : prev.unseen,
        pipelineCounts,
      };
    });
  }, []);

  const setProjectStatus = useCallback((projectId: string, status: "viewed" | "submitted") => {
    setState((prev) => {
      const index = prev.projects.findIndex((p) => p.id === projectId);
      if (index === -1) return prev;
      const project = prev.projects[index];
      const from = pipelineStatus(project.status);
      const to = pipelineStatus(status);
      if (from === to && project.status === status) return prev;

      const projects = [...prev.projects];
      projects[index] = { ...project, status };
      const pipelineCounts = { ...prev.pipelineCounts };
      if (from !== to) {
        if (from === "new") pipelineCounts.new = Math.max(0, pipelineCounts.new - 1);
        else if (from === "submitted") {
          pipelineCounts.submitted = Math.max(0, pipelineCounts.submitted - 1);
        } else pipelineCounts.seen = Math.max(0, pipelineCounts.seen - 1);

        if (to === "new") pipelineCounts.new += 1;
        else if (to === "submitted") pipelineCounts.submitted += 1;
        else pipelineCounts.seen += 1;
      }

      return {
        ...prev,
        projects,
        pipelineCounts,
        unseen:
          project.status === "new" && status === "viewed"
            ? Math.max(0, prev.unseen - 1)
            : prev.unseen,
      };
    });
  }, []);

  useEffect(() => {
    if (onFindPage) {
      clearUnread();
    }
  }, [onFindPage, clearUnread]);

  useEffect(() => {
    if (!autoRefreshEnabled) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    const tick = () => {
      void refresh({ silent: true, filters: filtersRef.current });
    };

    pollTimerRef.current = setInterval(tick, pollIntervalMs(pollIntervalSec));
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [refresh, pollIntervalSec, autoRefreshEnabled]);

  const value = useMemo(
    () => ({
      state,
      unreadNew,
      recentPollNew,
      pollIntervalSec,
      setPollIntervalSec,
      autoRefreshEnabled,
      setAutoRefreshEnabled,
      desktopNotificationsEnabled,
      setDesktopNotificationsEnabled,
      notificationPermission,
      refresh,
      refreshList,
      refreshForList,
      setActiveFilters,
      clearUnread,
      dismissRecentPollNew,
      markProjectSeen,
      confirmProjectSeenOnServer,
      removeProject,
      setProjectStatus,
    }),
    [
      state,
      unreadNew,
      recentPollNew,
      pollIntervalSec,
      setPollIntervalSec,
      autoRefreshEnabled,
      setAutoRefreshEnabled,
      desktopNotificationsEnabled,
      setDesktopNotificationsEnabled,
      notificationPermission,
      refresh,
      refreshList,
      refreshForList,
      setActiveFilters,
      clearUnread,
      dismissRecentPollNew,
      markProjectSeen,
      confirmProjectSeenOnServer,
      removeProject,
      setProjectStatus,
    ],
  );

  return (
    <DiscoverMonitorContext.Provider value={value}>{children}</DiscoverMonitorContext.Provider>
  );
}

export function useDiscoverMonitor() {
  const ctx = useContext(DiscoverMonitorContext);
  if (!ctx) {
    throw new Error("useDiscoverMonitor must be used within DiscoverMonitorProvider");
  }
  return ctx;
}
