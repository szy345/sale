import { getLicenseStatus } from '../services/license.js';

export function licenseGuard(req, res, next) {
  const status = getLicenseStatus();
  if (status.allowed) {
    req.licenseStatus = status;
    next();
    return;
  }

  res.status(403).json({
    code: 'LICENSE_REQUIRED',
    status: status.status,
    message: status.message || '系统授权已失效，请导入正式授权',
    days_remaining: status.days_remaining,
  });
}
