import { Router } from 'express';
import authRoutes from './auth.routes';
import employeeRoutes from './employees.routes';
import clientRoutes from './clients.routes';
import assignmentRoutes from './assignments.routes';
import timesheetRoutes from './timesheets.routes';
import invoiceRoutes from './invoices.routes';
import reportRoutes from './reports.routes';
import documentRoutes from './documents.routes';
import notificationRoutes from './notifications.routes';
import adminRoutes from './admin.routes';

export const router = Router();

router.use('/auth', authRoutes);
router.use('/employees', employeeRoutes);
router.use('/clients', clientRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/timesheets', timesheetRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/reports', reportRoutes);
router.use('/documents', documentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
