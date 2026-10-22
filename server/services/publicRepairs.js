import { config } from '../config.js';
import { db } from '../db.js';
import { AppError } from '../lib/errors.js';
import { getSystemName } from './settings.js';

function maskName(value) {
  const name = String(value || '').trim();
  if (!name) return '';
  if (name.length <= 1) return name;
  return `${name.slice(0, 1)}${'*'.repeat(Math.min(name.length - 1, 2))}`;
}

function maskPhone(value) {
  const phone = String(value || '').trim();
  if (!phone) return '';
  if (phone.length <= 7) return `${phone.slice(0, 2)}****`;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

export function getPublicRepairByToken(token) {
  const order = db
    .prepare(
      `SELECT id, ticket_no, repair_date, status, current_round,
              product_name, item_no, color, size, customer_name, phone
       FROM repair_orders
       WHERE public_token = ?`,
    )
    .get(String(token || ''));

  if (!order) throw new AppError(404, '未找到维修单，请确认二维码是否正确');

  const events = db
    .prepare(
      `SELECT round_no, stage, event_date
       FROM repair_events
       WHERE repair_id = ? AND voided_at IS NULL
       ORDER BY round_no ASC, id ASC`,
    )
    .all(order.id);

  return {
    systemName: getSystemName(),
    shopPhone: config.shopPhone || '',
    shopAddress: config.shopAddress || '',
    repair: {
      ticket_no: order.ticket_no,
      repair_date: order.repair_date,
      status: order.status,
      current_round: order.current_round,
      product_name: order.product_name,
      item_no: order.item_no,
      color: order.color,
      size: order.size,
      customer_name: maskName(order.customer_name),
      phone: maskPhone(order.phone),
      events,
    },
  };
}
