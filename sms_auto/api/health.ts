// Vercel Serverless Function: /api/health
export default function handler(_req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    status: 'ok',
    platform: 'Vercel Serverless',
    service: 'Hệ thống Xử lý Dữ liệu SMS - Bệnh viện Đa khoa Ninh Thuận',
    timestamp: new Date().toISOString(),
  });
}
