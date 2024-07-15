import { OPENAIKEY } from "../config/config";
import axios from "axios";
type AgentProp = {
  /**
   * The identity of the agent
   * @example
   * "You are a cover-letter writer."
   */
  identity: string;

  /**
   * ChatGPT Model
   *  @example
   * "gpt-3-turbo" , "gpt-4-turbo" , "gpt-4-o"
   */
  default_model: "gpt-3.5-turbo" | "gpt-4-turbo" | "gpt-4o";
};

export default class Agent {
  identity: AgentProp["identity"];
  default_model: AgentProp["default_model"];
  constructor(props: AgentProp) {
    this.identity = props.identity;
    this.default_model = props.default_model;
  }
  analyze(
    query: string,
    model: AgentProp["default_model"] = this.default_model
  ) {
    return {
      output: queryLLM(this, model, query),
    };
  }
}

function queryLLM(
  agent: Agent,
  model: AgentProp["default_model"],
  query: string
) {
  return async function <T>(output_type: T) {
    const question = `${query}\n\nRespond in the following json format:\n${JSON.stringify(
      output_type
    )}`;
    const response: T = await axios
      .post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: model,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: agent.identity,
            },
            {
              role: "user",
              content: question,
            },
          ],
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAIKEY}`,
          },
        }
      )
      .then((response) => response.data)
      .then((data) => JSON.parse(data.choices[0].message.content as string));
    return response;
  };
}
