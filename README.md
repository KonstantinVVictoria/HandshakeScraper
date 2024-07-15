# Handshake Quick Apply ⚡

_Employers are automating the application process in their end, why not wedo the same?_

Handshake Quick Apply is a bot that utilizes Playwright and ChatGPT to automat the application process for you. It looks through your job listings, check whether a job matches your preference, and then automatically applies for you. It will even write cover letters for you.

## Scraping Process

The bot uses playwright to automatically scrape your job listings in preset batches. It gathers all the information and then prompts ChatGPT, asking if a job listing meets your preferences.

# Application Process

The bot can only apply to applications that are completable within the site. It cannot apply to applications that lead you to an external site. It can only apply to applications that require both a cover letter and a resume. For applications that require a cover letter, one will be automatically generated for you via ChatGPT.

# Installation 🛠️

## Prerequisites

1. You must have Microsoft Edge
2. You must have a user profile in Microsoft Edge
3. You must already be signed into Handshake in Microsoft Edge
4. In Handshake, you must already have a resume uploaded.
5. You must have an OpenAI key available

## Installation Process

1. `git clone` the repo into your local system
2. type `npm install` to install all the necessary dependancies

## Configuration Process

1. In `config/config.ts`, paste in your OpenAI Key in `OPENAIKEY`.
2. Type in `edge://version` in the address bar of Edge.
   i. Find your Edge user profile path and paste it in `EDGEUSERPROFILEPATH`.
   ii. Find your Edge executable path and paste it in `EDGEEXECUTABLEPATH`.
3. Page Number is the number of the page of listings the bot will start scraping at.
4. Batch size is how many listings it will scrape at once. Lower it to increase performance. Increase it to speed up the scraping process.
5. OpenAI Model is the type of model that will be utilized in the scraping process. At this moment, the model responsible for writing cover letter is `gpt-4o` despite the option you define for this field.
6. In `personalize_experience.txt` type in the raw text format of your resume, or a condensed version of your experiences.
7. In `requirement_prompt.txt` type in your job preferences -- what you are looking for?

# Known Bugs 🐜

1. Sometimes Handshake will throttle your request and you may have a batch that won't render the page. This is presumably their way to handle automatic scrapers, but it will be resolved after a few moments.
2. I still need to handle the edge case in which no documents are required and it is just one tap apply.
