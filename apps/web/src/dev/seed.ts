/**
 * Демо-дані живуть у ядрі — їх показують і веб, і телефон. Тут лишається
 * тільки прапорець збірки: у робочому застосунку школи демо не потрібне.
 */
export { DEMO_CURRENT_ID, DEMO_HISTORY_ID, DEMO_IDS, removeDemo, seedDemo } from '@journal/core';

export const DEMO_ENABLED = import.meta.env.VITE_ENABLE_DEMO === '1';
