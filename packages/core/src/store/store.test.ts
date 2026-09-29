import { runStoreConformance } from './conformance';
import { MemoryDriver } from './memory';

runStoreConformance('у пам\'яті', async () => new MemoryDriver());
