export const REQUIREMENTS = fs.readFileSync(
  "./config/requirement_prompt.txt",
  "utf-8"
);
import * as fs from "fs";
export const OPENAIKEY =
  "sk-proj-WgTq3xh9cm28NVxtjv73T3BlbkFJ3vrDPFWqWbwAXtAyveXe";
export const EDGEUSERPROFILEPATH = `C:\Users\<User>\AppData\Local\Microsoft\Edge\User Data\Default`;
export const EDGEEXECUTABLEPATH = `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`;
export const PAGENUMBER = 1;
export const BATCHSIZE = 5;
export const OPENAIMODEL = "gpt-3.5-turbo"; //"gpt-3.5-turbo"//"gpt-4o"
