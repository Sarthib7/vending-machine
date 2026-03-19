import { createSeedProviders } from "./providers.js";
import type { Provider, VendRecord } from "./types.js";

export class InMemoryStore {
  private readonly vends = new Map<string, VendRecord>();
  private readonly providers = new Map<string, Provider>();

  public constructor() {
    for (const provider of createSeedProviders()) {
      this.providers.set(provider.id, provider);
    }
  }

  public listProviders(): Provider[] {
    return Array.from(this.providers.values());
  }

  public createProvider(provider: Provider): Provider {
    this.providers.set(provider.id, provider);
    return provider;
  }

  public getProvider(providerId: string): Provider | undefined {
    return this.providers.get(providerId);
  }

  public saveVend(record: VendRecord): VendRecord {
    this.vends.set(record.id, record);
    return record;
  }

  public getVend(vendId: string): VendRecord | undefined {
    return this.vends.get(vendId);
  }
}

export const store = new InMemoryStore();
