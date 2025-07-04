import { type LambdaEvent, type Options as LambdaLocalOptions } from 'lambda-local';
export type WorkerData = LambdaLocalOptions & {
    entryFilePath: string;
};
export interface WorkerMessage extends LambdaEvent {
    streamPort?: number;
}
//# sourceMappingURL=worker.d.ts.map