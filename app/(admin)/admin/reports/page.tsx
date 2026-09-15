import {
  getRevenueReportData,
  getInventoryReportData,
  getReturnsReportData,
  getCustomersReportData,
  getAuditReportData,
} from '@/app/actions/reports';
import ReportsClient from './ReportsClient';

export default async function AdminReportsPage() {
  const [revenueData, inventoryData, returnsData, customersData, auditData] = await Promise.all([
    getRevenueReportData(),
    getInventoryReportData(),
    getReturnsReportData(),
    getCustomersReportData(),
    getAuditReportData(),
  ]);

  return (
    <ReportsClient
      revenueData={revenueData}
      inventoryData={inventoryData}
      returnsData={returnsData}
      customersData={customersData}
      auditData={auditData}
    />
  );
}
