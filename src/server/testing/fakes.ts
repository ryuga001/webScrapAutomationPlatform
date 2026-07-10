// In-memory fakes implementing the domain interfaces, so services can be tested
// without Prisma, bcrypt or jwt. This is the payoff of Dependency Inversion:
// the same services run against these fakes in tests and Prisma in production.

import type {
  CreateUserData,
  IUserRepository,
  IWorkflowRepository,
  UserRecord,
} from "@/server/domain/repositories";
import type {
  IPasswordHasher,
  ITokenService,
  TokenPayload,
} from "@/server/domain/security";
import type {
  Workflow,
  WorkflowInput,
  WorkflowRunResult,
} from "@/lib/workflow";
import type { IAiSuggestionProvider } from "@/server/domain/ai";
import type { ChatSuggestInput, Suggestion } from "@/lib/chat-suggest";

let seq = 0;
const id = (p: string) => `${p}_${++seq}`;

export class FakeUserRepository implements IUserRepository {
  readonly users: UserRecord[] = [];

  async create(data: CreateUserData): Promise<UserRecord> {
    const now = new Date();
    const user: UserRecord = {
      id: id("user"),
      username: data.username,
      email: data.email,
      passwordHash: data.passwordHash,
      role: "USER",
      createdAt: now,
      updatedAt: now,
    };
    this.users.push(user);
    return user;
  }

  async findById(id: string) {
    return this.users.find((u) => u.id === id) ?? null;
  }
  async findByEmail(email: string) {
    return this.users.find((u) => u.email === email) ?? null;
  }
  async findByUsername(username: string) {
    return this.users.find((u) => u.username === username) ?? null;
  }
}

/** Deterministic, fast stand-in for bcrypt. */
export class FakeHasher implements IPasswordHasher {
  async hash(plain: string) {
    return `hashed:${plain}`;
  }
  async verify(plain: string, hash: string) {
    return hash === `hashed:${plain}`;
  }
}

/** Opaque token = base64 of the payload; no crypto. */
export class FakeTokenService implements ITokenService {
  sign(payload: TokenPayload) {
    return Buffer.from(JSON.stringify(payload)).toString("base64");
  }
  verify(token: string): TokenPayload {
    return JSON.parse(Buffer.from(token, "base64").toString("utf8"));
  }
}

export class FakeWorkflowRepository implements IWorkflowRepository {
  private store = new Map<string, { userId: string; wf: Workflow }>();
  readonly runs: { id: string; result: WorkflowRunResult }[] = [];

  async listByUser(userId: string) {
    return [...this.store.values()]
      .filter((e) => e.userId === userId)
      .map((e) => e.wf);
  }

  async findByIdForUser(id: string, userId: string) {
    const e = this.store.get(id);
    return e && e.userId === userId ? e.wf : null;
  }

  async create(userId: string, input: WorkflowInput) {
    const now = new Date().toISOString();
    const wf: Workflow = {
      id: id("wf"),
      name: input.name,
      nodes: input.nodes,
      edges: input.edges,
      viewport: input.viewport,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(wf.id, { userId, wf });
    return wf;
  }

  async update(id: string, userId: string, input: WorkflowInput) {
    const e = this.store.get(id);
    if (!e || e.userId !== userId) return null;
    e.wf = { ...e.wf, ...input, updatedAt: new Date().toISOString() };
    return e.wf;
  }

  async delete(id: string, userId: string) {
    const e = this.store.get(id);
    if (!e || e.userId !== userId) return false;
    this.store.delete(id);
    return true;
  }

  async saveRun(id: string, userId: string, result: WorkflowRunResult) {
    const e = this.store.get(id);
    if (!e || e.userId !== userId) return false;
    this.runs.push({ id, result });
    return true;
  }
}

/** Canned AI provider; records the last input so tests can assert what it got. */
export class FakeAiProvider implements IAiSuggestionProvider {
  lastInput: ChatSuggestInput | null = null;

  constructor(private readonly replies: string[] = ["Sure!", "Sounds good."]) {}

  async suggest(input: ChatSuggestInput): Promise<Suggestion[]> {
    this.lastInput = input;
    return this.replies
      .slice(0, input.count ?? this.replies.length)
      .map((text) => ({ text }));
  }
}
