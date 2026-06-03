import { Request, Response, NextFunction } from 'express';
import { sendContactEmail } from '../lib/mailer';
import type { ContactInput } from '../schemas/contact.schema';

export async function submit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as ContactInput;
    // Honeypot: a filled hidden field means a bot. Pretend success, send nothing.
    if (body.website && body.website.trim() !== '') {
      res.json({ success: true });
      return;
    }
    await sendContactEmail({
      name: body.name,
      email: body.email,
      phone: body.phone || undefined,
      subject: body.subject || undefined,
      message: body.message,
    });
    res.json({ success: true });
  } catch (err) { next(err); }
}
