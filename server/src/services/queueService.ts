import { EventEmitter } from 'events';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Job {
  id: string;
  status: JobStatus;
  progress: number;
  data: any;
  result?: any;
  error?: string;
  createdAt: number;
}

class QueueService extends EventEmitter {
  private jobs: Map<string, Job> = new Map();
  private queue: string[] = [];
  private processing: number = 0;
  private readonly CONCURRENCY = 1; // Un solo render a la vez para no saturar CPU

  public addJob(id: string, data: any): Job {
    const job: Job = {
      id,
      status: 'pending',
      progress: 0,
      data,
      createdAt: Date.now(),
    };
    this.jobs.set(id, job);
    this.queue.push(id);
    this.processNext();
    return job;
  }

  public getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  public updateProgress(id: string, progress: number) {
    const job = this.jobs.get(id);
    if (job) {
      job.progress = progress;
      this.emit('progress', job);
    }
  }

  private async processNext() {
    if (this.processing >= this.CONCURRENCY || this.queue.length === 0) {
      return;
    }

    const jobId = this.queue.shift()!;
    const job = this.jobs.get(jobId);
    if (!job) return;

    this.processing++;
    job.status = 'processing';
    this.emit('start', job);

    try {
      // Execute the job payload (the function passed in data)
      const result = await job.data.execute((progress: number) => {
        this.updateProgress(jobId, progress);
      });
      job.status = 'completed';
      job.progress = 100;
      job.result = result;
      this.emit('completed', job);
    } catch (err: any) {
      job.status = 'failed';
      job.error = err.message;
      this.emit('failed', job);
    } finally {
      this.processing--;
      this.processNext();
    }
  }
}

export const queueService = new QueueService();
