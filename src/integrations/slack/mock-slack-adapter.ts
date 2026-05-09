import { MockBehaviorConfig, throwIfConfiguredToFail } from "../mock-behavior";
import { SlackAdapter, SlackExternalResult } from "./slack-adapter";

export type MockSlackConfig = MockBehaviorConfig;

export class MockSlackAdapter implements SlackAdapter {
  private messageCalls = 0;

  constructor(private readonly config: MockSlackConfig) {}

  async sendMessage(_channel: string, _message: string): Promise<SlackExternalResult> {
    this.messageCalls += 1;
    throwIfConfiguredToFail(this.config, this.messageCalls, "MockSlackAdapter");
    return { externalId: `mock-slack-message-${this.messageCalls}` };
  }
}
