export type MapViewScopeControlAction = {
  id: string;
  label: string;
  icon: string;
};

export const MAP_VIEW_SCOPE_CONTROL_ACTIONS: readonly MapViewScopeControlAction[] = [
  { id: 'save', label: 'Save map position', icon: 'save' },
  { id: 'snap', label: 'Snap back to saved position', icon: 'snap' },
] as const;

export function mapViewScopeControlActionsJson(): string {
  return JSON.stringify(MAP_VIEW_SCOPE_CONTROL_ACTIONS);
}