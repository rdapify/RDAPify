/**
 * Query prioritization system
 * @module application/services/QueryPriority
 */

export type Priority = 'high' | 'normal' | 'low';

export interface PriorityQueueItem<T> {
  id: string;
  priority: Priority;
  data: T;
  timestamp: number;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}

/**
 * Priority queue for managing query execution order
 */
export class QueryPriorityQueue<T = any> {
  private highPriorityQueue: PriorityQueueItem<T>[] = [];
  private normalPriorityQueue: PriorityQueueItem<T>[] = [];
  private lowPriorityQueue: PriorityQueueItem<T>[] = [];
  private processing: boolean = false;
  private concurrency: number;
  private activeCount: number = 0;
  private processor: (item: T) => Promise<any>;

  constructor(concurrency: number = 5, processor: (item: T) => Promise<any>) {
    this.concurrency = concurrency;
    this.processor = processor;
  }

  /**
   * Adds an item to the queue
   */
  async enqueue(data: T, priority: Priority = 'normal'): Promise<any> {
    return new Promise((resolve, reject) => {
      const item: PriorityQueueItem<T> = {
        id: `${Date.now()}-${Math.random()}`,
        priority,
        data,
        timestamp: Date.now(),
        resolve,
        reject,
      };

      // Add to appropriate queue
      switch (priority) {
        case 'high':
          this.highPriorityQueue.push(item);
          break;
        case 'low':
          this.lowPriorityQueue.push(item);
          break;
        case 'normal':
        default:
          this.normalPriorityQueue.push(item);
          break;
      }

      // Start processing if not already running
      this.processQueue();
    });
  }

  /**
   * Processes items in the queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.hasItems() && this.activeCount < this.concurrency) {
      const item = this.dequeue();
      if (!item) break;

      this.activeCount++;

      // Process item
      this.processor(item.data)
        .then((result) => {
          item.resolve(result);
        })
        .catch((error) => {
          item.reject(error);
        })
        .finally(() => {
          this.activeCount--;
          this.processQueue(); // Continue processing
        });
    }

    this.processing = false;
  }

  /**
   * Removes and returns the next item from the queue
   */
  private dequeue(): PriorityQueueItem<T> | undefined {
    // High priority first
    if (this.highPriorityQueue.length > 0) {
      return this.highPriorityQueue.shift();
    }

    // Then normal priority
    if (this.normalPriorityQueue.length > 0) {
      return this.normalPriorityQueue.shift();
    }

    // Finally low priority
    if (this.lowPriorityQueue.length > 0) {
      return this.lowPriorityQueue.shift();
    }

    return undefined;
  }

  /**
   * Checks if queue has items
   */
  private hasItems(): boolean {
    return (
      this.highPriorityQueue.length > 0 ||
      this.normalPriorityQueue.length > 0 ||
      this.lowPriorityQueue.length > 0
    );
  }

  /**
   * Gets queue statistics
   */
  getStats(): {
    high: number;
    normal: number;
    low: number;
    total: number;
    active: number;
    concurrency: number;
  } {
    return {
      high: this.highPriorityQueue.length,
      normal: this.normalPriorityQueue.length,
      low: this.lowPriorityQueue.length,
      total:
        this.highPriorityQueue.length +
        this.normalPriorityQueue.length +
        this.lowPriorityQueue.length,
      active: this.activeCount,
      concurrency: this.concurrency,
    };
  }

  /**
   * Clears all queues
   */
  clear(): void {
    // Reject all pending items
    const rejectAll = (queue: PriorityQueueItem<T>[]) => {
      queue.forEach((item) => {
        item.reject(new Error('Queue cleared'));
      });
    };

    rejectAll(this.highPriorityQueue);
    rejectAll(this.normalPriorityQueue);
    rejectAll(this.lowPriorityQueue);

    this.highPriorityQueue = [];
    this.normalPriorityQueue = [];
    this.lowPriorityQueue = [];
  }

  /**
   * Gets the size of the queue
   */
  size(): number {
    return (
      this.highPriorityQueue.length +
      this.normalPriorityQueue.length +
      this.lowPriorityQueue.length
    );
  }

  /**
   * Checks if queue is empty
   */
  isEmpty(): boolean {
    return this.size() === 0;
  }
}
