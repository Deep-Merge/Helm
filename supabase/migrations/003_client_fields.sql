-- Client profile fields on projects

alter table projects add column if not exists client_location text;
alter table projects add column if not exists client_country_flag text;
alter table projects add column if not exists client_review_count int;
