import Agent from "./lib/Agent";

const Analyzer = new Agent({
  identity: "You derive information from documents.",
  default_model: "gpt-3.5-turbo",
});

const Writer = new Agent({
  identity: "You are an excellent and thoughtful cover letter writer.",
  default_model: "gpt-4o",
});

const cover_letter_schema = {
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
  },
};

export default async function write_cover_letter(
  experience: string,
  job_details: string
) {
  const output = await Writer.analyze(
    `Based on my experience:\n${experience}\n\nAnd the following job details:\n${job_details}\n\nWrite a cover-letter that is appropriate, relevant, and thoughtful.`
  )
    .output(cover_letter_schema)
    .then(async (cover_letter) => {
      const critique = await Analyzer.analyze(
        `Based on the cover letter data:\n${JSON.stringify(
          cover_letter
        )}\nCheck whether there are errors and areas of improvements, if not, do not make any comments.`
      ).output({
        needs_improvement: "boolean",
        contains_errors: "boolean",
        comments: "boolean",
      });
      return { critique, cover_letter };
    })
    .then(async ({ critique, cover_letter }) => {
      if (critique.needs_improvement || critique.contains_errors) {
        return await Writer.analyze(
          `Based on the cover letter data:\n${JSON.stringify(
            cover_letter
          )}\n\nAnd the following critique\n${
            critique.comments
          }\nImprove the cover-letter`
        ).output(cover_letter_schema);
      } else return cover_letter;
    });
  return output;
}
