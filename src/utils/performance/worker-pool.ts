/**
 * Web Worker Pool for Heavy Geospatial Computations
 * Offloads CPU-intensive operations to prevent UI blocking
 */

export interface WorkerTask<T = any, R = any> {
  id: string;
  type: string;
  data: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
}

export class GeospatialWorkerPool {
  private workers: Worker[] = [];
  private taskQueue: WorkerTask[] = [];
  private activeTasks = new Map<string, WorkerTask>();
  private workerBusy: boolean[] = [];

  constructor(
    private workerScript: string,
    private poolSize: number = navigator.hardwareConcurrency || 4
  ) {
    this.initializeWorkers();
  }

  private initializeWorkers(): void {
    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(this.workerScript);
      worker.onmessage = (event) => this.handleWorkerMessage(i, event);
      worker.onerror = (error) => this.handleWorkerError(i, error);
      
      this.workers.push(worker);
      this.workerBusy.push(false);
    }
  }

  private handleWorkerMessage(workerIndex: number, event: MessageEvent): void {
    const { taskId, result, error } = event.data;
    const task = this.activeTasks.get(taskId);
    
    if (task) {
      this.activeTasks.delete(taskId);
      this.workerBusy[workerIndex] = false;
      
      if (error) {
        task.reject(new Error(error));
      } else {
        task.resolve(result);
      }
      
      // Process next task in queue
      this.processNextTask();
    }
  }

  private handleWorkerError(workerIndex: number, error: ErrorEvent): void {
    console.error(`Worker ${workerIndex} error:`, error);
    this.workerBusy[workerIndex] = false;
    
    // Find and reject any active task for this worker
    for (const [taskId, task] of this.activeTasks.entries()) {
      // Simple heuristic: reject the oldest task
      task.reject(new Error(`Worker error: ${error.message}`));
      this.activeTasks.delete(taskId);
      break;
    }
    
    this.processNextTask();
  }

  private processNextTask(): void {
    if (this.taskQueue.length === 0) return;
    
    const availableWorkerIndex = this.workerBusy.findIndex(busy => !busy);
    if (availableWorkerIndex === -1) return;
    
    const task = this.taskQueue.shift()!;
    this.workerBusy[availableWorkerIndex] = true;
    this.activeTasks.set(task.id, task);
    
    this.workers[availableWorkerIndex].postMessage({
      taskId: task.id,
      type: task.type,
      data: task.data
    });
  }

  /**
   * Execute a task in the worker pool
   */
  execute<T, R>(type: string, data: T): Promise<R> {
    return new Promise((resolve, reject) => {
      const task: WorkerTask<T, R> = {
        id: `${Date.now()}-${Math.random()}`,
        type,
        data,
        resolve,
        reject
      };

      this.taskQueue.push(task);
      this.processNextTask();
    });
  }

  /**
   * Terminate all workers
   */
  terminate(): void {
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    this.workerBusy = [];
    
    // Reject all pending tasks
    for (const task of this.activeTasks.values()) {
      task.reject(new Error('Worker pool terminated'));
    }
    this.activeTasks.clear();
    
    for (const task of this.taskQueue) {
      task.reject(new Error('Worker pool terminated'));
    }
    this.taskQueue = [];
  }
}

// Singleton instance for the library
let workerPool: GeospatialWorkerPool | null = null;

/**
 * Get or create the global worker pool
 */
export function getWorkerPool(): GeospatialWorkerPool {
  if (!workerPool) {
    // In a real implementation, this would point to a bundled worker script
    const workerScript = new URL('./geospatial-worker.js', import.meta.url);
    workerPool = new GeospatialWorkerPool(workerScript.href);
  }
  return workerPool;
}

/**
 * High-level functions for common heavy operations
 */

/**
 * Compute polygon intersection in worker
 */
export async function intersectPolygonsAsync(
  polygon1: any,
  polygon2: any
): Promise<any> {
  const pool = getWorkerPool();
  return pool.execute('intersectPolygons', { polygon1, polygon2 });
}

/**
 * Generate H3 cells for large polygon in worker
 */
export async function polygonToH3Async(
  polygon: any,
  resolution: number
): Promise<string[]> {
  const pool = getWorkerPool();
  return pool.execute('polygonToH3', { polygon, resolution });
}

/**
 * Cluster large point datasets in worker
 */
export async function clusterPointsAsync(
  points: Array<{ location: [number, number]; data?: any }>,
  options: { method: 'grid' | 'distance'; threshold: number }
): Promise<any[]> {
  const pool = getWorkerPool();
  return pool.execute('clusterPoints', { points, options });
}