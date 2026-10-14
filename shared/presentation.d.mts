export type Presentation = typeof import('./default-presentation.json');
export class PresentationError extends Error {}
export const themeNames: string[];
export function defaultPresentation(): Presentation;
export function themePreset(name: string): Presentation['theme'];
export function validatePresentation(value: unknown): Presentation;
export function configPath(): string;
export function loadPresentation(path?: string): Presentation;
export function presentation(): Presentation;
export function formatManagementTime(instant: string | number | Date, config: Presentation): string;
