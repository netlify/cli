export interface DeployEvent {
    type: string;
    msg: string;
    phase: 'start' | 'progress' | 'error' | 'stop';
}
export type StatusCallback = (status: DeployEvent) => void;
//# sourceMappingURL=status-cb.d.ts.map