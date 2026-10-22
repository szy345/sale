import { db } from '../db.js';
import { localDate } from '../lib/date.js';

function count(sql, ...params) {
  return Number(db.prepare(sql).get(...params).count);
}

export function getDashboard() {
  const today = localDate();
  const month = today.slice(0, 7);

  return {
    today,
    counts: {
      todayRepairs: count('SELECT COUNT(*) AS count FROM repair_orders WHERE repair_date = ?', today),
      pendingFactory: count(
        "SELECT COUNT(*) AS count FROM repair_orders WHERE status = 'pending_factory'",
      ),
      sentFactory: count(
        "SELECT COUNT(*) AS count FROM repair_orders WHERE status = 'sent_factory'",
      ),
      factoryReturned: count(
        "SELECT COUNT(*) AS count FROM repair_orders WHERE status = 'factory_returned'",
      ),
      customerNotified: count(
        "SELECT COUNT(*) AS count FROM repair_orders WHERE status = 'customer_notified'",
      ),
      customerPicked: count(
        "SELECT COUNT(*) AS count FROM repair_orders WHERE status = 'customer_picked'",
      ),
      totalRepairs: count('SELECT COUNT(*) AS count FROM repair_orders'),
      todayReturns: count('SELECT COUNT(*) AS count FROM return_orders WHERE return_date = ?', today),
      monthReturns: count(
        "SELECT COUNT(*) AS count FROM return_orders WHERE substr(return_date, 1, 7) = ?",
        month,
      ),
      totalReturns: count('SELECT COUNT(*) AS count FROM return_orders'),
    },
    recentRepairs: db
      .prepare(
        `SELECT r.id, r.ticket_no, r.repair_date, r.customer_name, r.phone, r.product_name,
                r.status, r.current_round, r.updated_at, u.display_name AS operator_name
         FROM repair_orders r
         JOIN users u ON u.id = r.operator_id
         ORDER BY r.id DESC LIMIT 8`,
      )
      .all(),
    recentReturns: db
      .prepare(
        `SELECT o.id, o.return_no, o.return_date, o.customer_name, o.phone, o.product_name,
                o.handling, o.refund_amount_cents, u.display_name AS operator_name
         FROM return_orders o
         JOIN users u ON u.id = o.operator_id
         ORDER BY o.id DESC LIMIT 8`,
      )
      .all(),
  };
}
