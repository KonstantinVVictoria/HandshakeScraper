import { BrowserContext, chromium, ElementHandle } from "playwright";
import {
  BATCHSIZE,
  EDGEEXECUTABLEPATH,
  EDGEUSERPROFILEPATH,
  OPENAIKEY,
  OPENAIMODEL,
  PAGENUMBER,
  REQUIREMENTS,
} from "./config";
import * as fs from "fs";

async function scrape() {
  const browser = await chromium.launchPersistentContext(EDGEUSERPROFILEPATH, {
    headless: false,
    executablePath: EDGEEXECUTABLEPATH,
  });
  const page = await browser.newPage();

  try {
    await page.goto(
      `https://cpp.joinhandshake.com/stu/postings?page=${PAGENUMBER}&per_page=25&sort_direction=desc&sort_column=default`
    );
  } catch (error) {
    console.log(error);
  }
  const listings = [];
  while (true) {
    await page.waitForSelector("[data-hook='jobs-card']");
    const jobs = Array.from(
      await page.$$("[data-hook='jobs-card']")
    ) as ElementHandle<HTMLAnchorElement>[];

    const NextButton = (await page.$(
      "[data-hook='search-pagination-next']"
    )) as ElementHandle<HTMLButtonElement>;
    const original_length = jobs.length;
    while (jobs.length > BATCHSIZE) {
      const queue = [];
      for (let i = 0; i < BATCHSIZE; i++) {
        queue.push(jobs.pop());
      }
      const results = await Promise.all(
        queue.map((job) => apply(browser, job))
      );
      console.log(jobs.length, "/", original_length, "left");
      results.forEach((result) => listings.push(result));
      fs.writeFileSync("applications.json", JSON.stringify(listings));
    }
    const results = await Promise.all(jobs.map((job) => apply(browser, job)));
    results.forEach((result) => listings.push(result));

    fs.writeFileSync("applications.json", JSON.stringify(listings));
    await NextButton.click();
  }
}
type Listing = {
  employer: {
    name: string;
    type: string;
  };
  title: string;
  dates: {
    posted: string;
    apply_by: string;
  };
  wage: string;
  location: string;
  position: {
    length: string;
    type: string;
  };
  details: string;
  application_status: {
    applied: boolean;
    date: string;
    reason: string;
  };
  link: string;
};

type ShouldApply = {
  should_apply: boolean;
  short_reason: string;
};
async function apply(
  browser: BrowserContext,
  job: ElementHandle<HTMLAnchorElement>
) {
  const page = await browser.newPage();
  try {
    const job_uri = await job.getAttribute("href");

    if (job_uri) {
      await page.goto(`https://cpp.joinhandshake.com${job_uri}`);
      const post = await page.waitForSelector("[data-hook='card']");
      const job_info = await post.evaluate((element) => {
        function traverse(element: HTMLElement | SVGElement, path: number[]) {
          try {
            let curr_e: HTMLElement | Node = element;
            for (const i of path) {
              curr_e = curr_e.childNodes[i];
            }
            return curr_e;
          } catch (error) {
            return undefined;
          }
        }
        const MoreButton = Array.from(
          traverse(element, [0, 3, 3, 0, 0, 0]).childNodes
        ).pop() as HTMLButtonElement;

        MoreButton.click();

        const listing: Listing = {
          employer: {
            name: traverse(element, [0, 0, 1, 0]).textContent,
            type: traverse(element, [0, 0, 1, 1]).textContent,
          },
          title: traverse(element, [0, 1]).textContent,
          dates: {
            posted: traverse(element, [0, 2, 0]).textContent,
            apply_by: traverse(element, [0, 2, 2]).textContent,
          },
          wage: traverse(element, [0, 3, 2, 1]).textContent,
          location: traverse(element, [0, 3, 2, 2, 1, 0]).textContent,
          position: {
            length: traverse(element, [0, 3, 2, 3, 1, 1]).textContent,
            type: traverse(element, [0, 3, 2, 3, 1, 0]).textContent,
          },
          application_status: {
            applied: false,
            reason: "",
            date: "",
          },
          details: traverse(element, [0, 3, 3, 0, 0, 0]).textContent,
          link: "",
        };

        return listing;
      });
      const job_details = job_info.details;

      job_info.link = `https://cpp.joinhandshake.com${job_uri}`;
      const analysis = await should_submit(job_info, REQUIREMENTS);

      if (analysis.should_apply) {
        const can_apply = await post.evaluate((element) => {
          function traverse(element: HTMLElement | SVGElement, path: number[]) {
            try {
              let curr_e: HTMLElement | Node = element;
              for (const i of path) {
                curr_e = curr_e.childNodes[i];
              }
              return curr_e;
            } catch (error) {
              return undefined;
            }
          }

          const ApplyButton = traverse(
            element,
            [0, 3, 1, 0, 0, 1]
          ) as HTMLButtonElement;

          if (
            ApplyButton &&
            !ApplyButton.disabled &&
            ApplyButton.textContent.toLowerCase().search("external") < 0
          ) {
            ApplyButton.click();
            ApplyButton.click();
            ApplyButton.click();
            return true;
          } else false;
        });
        if (!can_apply) {
          console.log(job_info.title, "Must Apply Externally");
          job_info.application_status = {
            applied: false,
            reason: "Must Apply Externally",
            date: new Date().toLocaleString(),
          };
          await page.close();
          return job_info;
        }
        await page.waitForSelector("fieldset");

        let app_status = await post.evaluate((element) => {
          function traverse(element: HTMLElement | SVGElement, path: number[]) {
            let curr_e: HTMLElement | Node = element;
            for (const i of path) {
              curr_e = curr_e.childNodes[i];
            }
            return curr_e;
          }

          const Fields = Array.from(document.querySelectorAll("fieldset"));
          let needs_other_docs = false;
          let needs_cover_letter = false;
          for (const Field of Fields) {
            const header = traverse(Field, [0]).textContent;
            if (header.search("resume") > -1) {
              const RecentlyAdded = traverse(
                Field,
                [1, 1, 1, 0]
              ) as HTMLButtonElement;
              RecentlyAdded.click();
            } else if (header.search("cover") > -1) {
              needs_cover_letter = true;
            } else {
              needs_other_docs = true;
            }
          }
          if (!needs_other_docs) {
            if (needs_cover_letter) {
              return "need_cover_letter";
            }
            return "submit";
          } else {
            return "need_documents";
          }
        });
        console.log(app_status);
        if (app_status === "need_cover_letter") {
          try {
            const UploadCoverLetterClass = await page.evaluate(() => {
              function traverse(
                element: HTMLElement | SVGElement,
                path: number[]
              ) {
                try {
                  let curr_e: HTMLElement | Node = element;
                  for (const i of path) {
                    curr_e = curr_e.childNodes[i];
                  }
                  return curr_e;
                } catch (error) {
                  return undefined;
                }
              }
              const Fields = Array.from(document.querySelectorAll("fieldset"));

              for (const Field of Fields) {
                const header = traverse(Field, [0]).textContent;
                if (header.search("cover") > -1) {
                  const UploadCoverLetter = traverse(
                    Field,
                    [1, 0, 0, 1, 0, 1]
                  ) as HTMLDivElement;

                  return UploadCoverLetter.className;
                }
              }
            });
            console.log(UploadCoverLetterClass);
            // const UploadButton = await page.$(
            //   `.${UploadCoverLetterClass} > span > button`
            // );

            // await UploadButton.click();
            // await UploadButton.click();
            // await UploadButton.click();
            console.log(
              "\x1b[32m%s\x1b[0m",
              "Generating Cover Letter for " + job_info.title
            );

            const cover_letter = await generate_cover_letter(
              job_details,
              browser
            );
            await page.setInputFiles(
              `.${UploadCoverLetterClass} > input`,
              cover_letter
            );
            const SubmitButton = await page.$(
              `span[data-hook="submit-application"] > div > button`
            );
            await SubmitButton.waitForElementState("enabled");
            app_status = "submit";
            console.log("Can Submit Cover Letter");
          } catch (error) {
            console.log(error);
          }
        }
        if (app_status === "submit") {
          await page.evaluate(() => {
            function traverse(
              element: HTMLElement | SVGElement,
              path: number[]
            ) {
              try {
                let curr_e: HTMLElement | Node = element;
                for (const i of path) {
                  curr_e = curr_e.childNodes[i];
                }
                return curr_e;
              } catch (error) {
                return undefined;
              }
            }
            const Modal = document.querySelector(
              '[data-hook="apply-modal-content"]'
            ) as HTMLSpanElement;
            const SubmitApp = traverse(
              Modal,
              [1, 1, 0, 0, 0, 0]
            ) as HTMLButtonElement;
            SubmitApp.click();
          });
          job_info.application_status = {
            applied: app_status === "submit",
            reason: analysis.short_reason,
            date: new Date().toLocaleString(),
          };
          console.log("\x1b[32m%s\x1b[0m", `${job_info.title} -- Applied`);
          await page.close();
        } else if (app_status === "need_documents") {
          const CloseButton = (await page.$(
            '[data-icon="times"]'
          )) as ElementHandle<HTMLElement>;

          job_info.application_status = {
            applied: false,
            reason: "More documents required",
            date: new Date().toLocaleString(),
          };
          console.log(job_info.title, "More documents required");
          await CloseButton.click();
          await page.close();
        }
      } else {
        console.log(job_info.title, "Should Not Apply");
        job_info.application_status = {
          applied: false,
          reason: analysis.short_reason,
          date: "",
        };
        await page.close();
        return job_info;
      }
      await page.close();
      return job_info;
    }
  } catch (error) {
    console.log("Could not apply, error");
    console.error(error);
    await page.close();
  }
}
const personal_experience = fs.readFileSync(
  "./personal_experience.txt",
  "utf-8"
);
const cover_letter_template = fs.readFileSync("./template.html", "utf-8");
type CoverLetter = {
  applicant: {
    name: string;
    address: string | null;
    phone: string;
    email: string;
  };
  date: Date;
  company: {
    hiring_manager: {
      name: string | null;
    };
    name: string | null;
    address: string | null;
    position_name: string;
  };
  cover_letter: {
    salutation: "string";
    body: "string";
    sign_off: "string;";
  };
};
function flatten_obj(obj, prefix = ""): string[] {
  return Object.keys(obj).reduce((acc, k) => {
    const pre = prefix.length ? prefix + "." : "";
    if (typeof obj[k] === "object" && obj[k] !== null) {
      Object.assign(acc, flatten_obj(obj[k], pre + k));
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {}) as string[];
}
async function generate_cover_letter(
  listing_details: string,
  browser: BrowserContext
) {
  const query = `# Personal Experience:\n${personal_experience}\n\nJob Listing:\n${listing_details}\n\nWith the job listing information and my personal experience, please write a professional, thoughtful, and impactful cover letter. Make sure it is relevant to the listing -- do not relate to unecessary experiences. Try to come out as genuine and passionate.\n\nRespond in the following json format:\n${JSON.stringify(
    {
      applicant: {
        name: "string",
        address: "string or null",
        phone: "string",
        email: "string",
      },
      company: {
        hiring_manager: {
          name: "string or null",
        },
        name: "string or null",
        address: "string or null",
        position_name: "string",
      },
      cover_letter: {
        salutation: "string",
        body: "string (DO NOT INCLUDE THE SALUTATION OR SIGNATURE, ONLY BODY OF COVER LETTER)",
        signature: "string (sign-off and signature)",
      },
    }
  )}`;

  const data = (await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAIKEY}`,
      "Content-Security-Policy":
        "default-src *; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval' stackexchange.com",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a great cover-letter writer",
        },
        {
          role: "user",
          content: query,
        },
      ],
    }),
  })
    .then((res) => res.json())
    .then((data: any) => {
      console.log(data);
      const result = JSON.parse(data.choices[0].message.content as string);
      return result;
    })) as CoverLetter;
  const position_name = data.company.position_name;
  data.company.position_name = undefined;
  const cover_letter_data = { ...data, date: new Date().toLocaleString() };
  let template = cover_letter_template;
  const flattened_paths = flatten_obj(cover_letter_data);
  console.log(flattened_paths);
  Object.entries(flattened_paths).forEach(([path, value]) => {
    template = template.replace(`{${path}}`, value || "");
  });

  const page = await browser.newPage();
  await page.setContent(template);
  const pdf_buffer = await page.pdf();
  const path_to_pdf =
    __dirname +
    `/cover_letters/${position_name}_${data.company.name}_${data.applicant.name}.pdf`;
  console.log("saving pdf");
  fs.writeFileSync(path_to_pdf, pdf_buffer, "binary");

  return path_to_pdf;
}

async function should_submit(listing: Listing, requirements: string) {
  const cleaned_listing = { ...listing, details: undefined, link: undefined };
  const query = `Based on this listing:\n\n${JSON.stringify(
    cleaned_listing
  )}\n\nCheck if one should apply based on their following requirement:\n${requirements}\n\nRespond with the following JSON format:\n${JSON.stringify(
    {
      should_apply: "boolean",
      short_reason: "short string",
    }
  )}`;

  const data = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAIKEY}`,
      "Content-Security-Policy":
        "default-src *; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval' stackexchange.com",
    },
    body: JSON.stringify({
      model: OPENAIMODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a recruiter",
        },
        {
          role: "user",
          content: query,
        },
      ],
    }),
  }).then((res) => res.json());
  return JSON.parse(data.choices[0].message.content as string) as ShouldApply;
}
scrape();
