import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/recurring.service';
import { runDailyTick } from '../jobs/scheduler';
import { ValidationError } from '../lib/errors';
import type { CreateRecurringInput, UpdateRecurringInput } from '../schemas/recurring.schema';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: await svc.listRecurring() }); } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: await svc.getRecurring(req.params.id) }); } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createRecurring(req.body as CreateRecurringInput, req.user?.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updateRecurring(req.params.id, req.body as UpdateRecurringInput, req.user?.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { await svc.deleteRecurring(req.params.id, req.user?.id); res.json({ success: true }); } catch (err) { next(err); }
}

// Generate one invoice from this template right now (manual trigger).
export async function runNow(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tpl = await svc.getRecurring(req.params.id);
    // Manual admin override — early runs (ahead of next_run_date) are allowed
    // on purpose, but a paused (or otherwise non-active) template must never be
    // run: that risks duplicate/early invoices racing the nightly cron or firing
    // for a template an admin intentionally paused.
    if (tpl.status !== 'active') {
      throw new ValidationError('Cannot run a paused template — activate it first.');
    }
    const invoiceId = await svc.runRecurringOnce(tpl, req.user?.id);
    res.json({ success: true, data: { invoiceId } });
  } catch (err) { next(err); }
}

// Manually fire the whole daily tick (recurring + reminders) — admin only.
export async function runTick(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: await runDailyTick() }); } catch (err) { next(err); }
}
