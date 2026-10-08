const salesReportService = require('../services/salesReportService');

const loadSalesReport = async (req, res) => {
    try {
        if (!req.session.adminId) {
            return res.redirect('/admin/login');
        }

        const { period, startDate, endDate } = req.query;

        // For feching data
        const reportData = await salesReportService.getSalesReportData(period, startDate, endDate);

        // For rendering ejs page
        res.render('admin/salesReport', {
            currentPage: 'sales-reports',
            orders: reportData.orders,
            kpi: reportData.kpi,
            currentFilter: reportData.currentFilter,
            startDate: reportData.startDate,
            endDate: reportData.endDate
        });

    } catch (error) {
        console.error('Error loading sales report:', error);
        res.status(500).send('Server Error loading sales report');
    }
};

module.exports = {
    loadSalesReport
};