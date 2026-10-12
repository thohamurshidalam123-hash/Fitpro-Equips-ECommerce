const salesReportService = require('../services/salesReportService');

const loadSalesReport = async (req, res) => {
    try {
        if (!req.session.adminId) {
            return res.redirect('/admin/login');
        }

        const { period, startDate, endDate } = req.query;

        // For feching data
        const [reportData, overviewStats] = await Promise.all([
            salesReportService.getSalesReportData(period, startDate, endDate),
            salesReportService.getSalesOverviewStats()
        ]);

        // For rendering ejs page
        res.render('admin/salesReport', {
            currentPage: 'sales-reports',
            orders: reportData.orders,
            kpi: reportData.kpi,
            currentFilter: reportData.currentFilter,
            startDate: reportData.startDate,
            endDate: reportData.endDate,
            ...overviewStats
        });

    } catch (error) {
        console.error('Error loading sales report:', error);
        res.status(500).send('Server Error loading sales report');
    }
};

const downloadPdfReport = async (req, res) => {
    try {
        if (!req.session.adminId) {
            return res.status(401).send('Unauthorized');
        }

        const { period, startDate, endDate } = req.query;

        // Generate the PDF stream
        const pdfStream = await salesReportService.generatePdfReport(period, startDate, endDate);

        // For setting headers for download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Sales_Report_${period || 'custom'}.pdf`);

        // For piping the generated PDF stream directly to the response
        pdfStream.pipe(res);

    } catch (error) {
        console.error('Error generating PDF report:', error);
        res.status(500).send('Server Error generating PDF report');
    }
};

module.exports = {
    loadSalesReport,
    downloadPdfReport
};