const dashboardService = require('../services/adminDashboardService');

const loadDashboard = async (req, res) => {
    try {
        if (!req.session.adminId) return res.redirect('/admin/login');

        // For fetching all the aggregated dashboard data
        const dashboardData = await dashboardService.getDashboardStats();

        res.render('admin/dashboard', { 
            currentPage: 'dashboard',
            totalOrders: dashboardData.totalOrders,
            pendingOrders: dashboardData.pendingOrders,
            completedOrders: dashboardData.completedOrders,
            totalRevenue: dashboardData.totalRevenue,
            totalUsers: dashboardData.totalUsers,
            activeUsers: dashboardData.activeUsers,
            blockedUsers: dashboardData.blockedUsers,
            topProducts: dashboardData.topProducts,
            topCategories: dashboardData.topCategories,
            topBrands: dashboardData.topBrands,
            chartData: dashboardData.chartData
        }); 
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
        res.status(500).send('Server Error loading dashboard');
    }
};

module.exports = {
    loadDashboard
};