import { EmbedAuthorOptions } from "discord.js";
import { Octokit } from "octokit";
import { Endpoints, OctokitResponse, RequestParameters } from "@octokit/types";

export default class githubService {
  octokit: Octokit = new Octokit(
    (process.env.GITHUB_TOKEN && { auth: process.env.GITHUB_TOKEN }) || {}
  );
  static cleanseIssueBody(body: string | null | undefined): string | undefined {
    return body?.replace(
      `### Is there an existing issue for this?
          
          - [X] I have searched the existing issues
          `,
      ""
    );
  }

  static getAuthor(
    user: {
      login: string;
      avatar_url: string;
      html_url: string;
    } | null
  ): EmbedAuthorOptions {
    return {
      name: user?.login || "Unknown",
      iconURL: user?.avatar_url,
      url: user?.html_url,
    };
  }

  async doRequest(path: string, options: any):Promise<any> {
    return await this.octokit.request(path, options);
  }
  async getIssue(
    options: RequestParameters
  ): Promise<
    Endpoints["GET /repos/{owner}/{repo}/issues/{issue_number}"]["response"]
  > {
    return await this.doRequest(
      "GET /repos/{owner}/{repo}/issues/{issue_number}",
      {
        ...options,
        owner: "makeplane",
        repo: "plane",
      }
    );
  }

  async getIssues(
    options: RequestParameters
  ): Promise<
    Endpoints["GET /repos/{owner}/{repo}/issues"]["response"]
  > {
    return await this.doRequest("GET /repos/{owner}/{repo}/issues", {
      ...options,
      owner: "makeplane",
      repo: "plane",
    });
  }

  async getPullRequest(
    options: RequestParameters
  ): Promise<
    Endpoints["GET /repos/{owner}/{repo}/pulls/{pull_number}"]["response"]
  > {
    return await this.doRequest("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
      ...options,
      owner: "makeplane",
      repo: "plane",
    });
  }

  async getPullRequests(
    options: RequestParameters
  ): Promise<
    Endpoints["GET /repos/{owner}/{repo}/pulls"]["response"]
  > {
    return await this.doRequest("GET /repos/{owner}/{repo}/pulls", {
      ...options,
      owner: "makeplane",
      repo: "plane",
    });
  }
}
