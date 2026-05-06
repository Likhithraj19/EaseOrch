export type GitHubPullRequestPayload = {
  action?: string;
  pull_request?: {
    number: number;
    title: string;
    html_url: string;
    merged?: boolean;
    merged_at?: string | null;
    body?: string | null;
    head: {
      ref: string;
    };
    user: {
      login: string;
    };
  };
  repository?: {
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
};
