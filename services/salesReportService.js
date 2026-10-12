const Order = require('../models/orderModel');
const PDFDocument = require('pdfkit-table');

const getSalesOverviewStats = async () => {
    const [totalOrders, pendingOrders, completedOrders, revenueResult] = await Promise.all([
        Order.countDocuments(),
        Order.countDocuments({ orderStatus: { $in: ['Pending', 'Processing', 'Packed', 'Shipped'] } }),
        Order.countDocuments({ orderStatus: 'Delivered' }),
        Order.aggregate([
            { $match: { orderStatus: 'Delivered' } },
            { $group: { _id: null, totalRevenue: { $sum: '$grandTotal' } } }
        ])
    ]);

    return {
        totalOrders,
        pendingOrders,
        completedOrders,
        totalRevenue: revenueResult[0]?.totalRevenue || 0
    };
};

const getSalesReportData = async (period = 'weekly', customStartDate, customEndDate) => {
    let startDate, endDate;
    const now = new Date();
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    switch (period) {
        case 'daily':
            startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'weekly':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 6); // Last 7 days including today
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'monthly':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 29); // Last 30 days
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'yearly':
            startDate = new Date(now.getFullYear(), 0, 1);
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'custom':
            startDate = customStartDate ? new Date(customStartDate) : new Date(now);
            startDate.setHours(0, 0, 0, 0);
            endDate = customEndDate ? new Date(customEndDate) : new Date(now);
            endDate.setHours(23, 59, 59, 999);
            break;
        default:
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            period = 'weekly';
    }

    // For count 'Delivered' orders as successful sales revenue
    const query = {
        orderStatus: 'Delivered',
        createdAt: { $gte: startDate,$lte: endDate }
    };

    const orders = await Order.find(query)
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .lean();

    let totalOrderAmount = 0;
    let totalDiscount = 0;
    let totalCouponDeductions = 0;

    const formattedOrders = orders.map(order => {
        const customerName = order.userId ? order.userId.name : (order.shippingAddress ? order.shippingAddress.name : 'Guest');
        
        totalOrderAmount += order.grandTotal || 0;
        
        // For calculating total discounts given
        const couponDiscount = order.discount || 0;
        const productOfferDiscount = order.productOfferDiscount || 0;
        totalDiscount += couponDiscount + productOfferDiscount;
        totalCouponDeductions += couponDiscount;

        return {
            orderId: order.orderId,
            customerName: customerName,
            grandTotal: order.grandTotal,
            discount: couponDiscount + productOfferDiscount,
            couponDiscount,
            productOfferDiscount,
            paymentMethod: order.paymentMethod,
            createdAt: order.createdAt
        };
    });

    // For setting up key performanace indicator
    const kpi = {
        totalOrders: orders.length,
        totalOrderAmount,
        totalDiscount,
        totalCouponDeductions
    };

    return {
        orders: formattedOrders,
        kpi,
        currentFilter: period,
        // For formatting dates as YYYY-MM-DD
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
    };
};

const generatePdfReport = async (period, customStartDate, customEndDate) => {
    // For fetch the exact same data we use for the webpage
    const reportData = await getSalesReportData(period, customStartDate, customEndDate);
    const { orders, kpi, startDate, endDate } = reportData;

    // Initialising PDF document
    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    // For document Header
    doc.fontSize(20).text('Fitpro Equips Sales Report', { align: 'center' });
    doc.moveDown();
    
    // For period information
    let periodText = period === 'custom' ? `Custom: ${startDate} to ${endDate}` : `Period: ${period.charAt(0).toUpperCase() + period.slice(1)}`;
    doc.fontSize(12).text(periodText, { align: 'center' });
    doc.moveDown(2);

    // For KPI Summary Section
    doc.fontSize(14).text('Summary Statistics', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Total Orders: ${kpi.totalOrders}`);
    doc.text(`Total Order Amount: Rs. ${kpi.totalOrderAmount.toLocaleString('en-IN')}`);
    doc.text(`Total Discounts Given: Rs. ${kpi.totalDiscount.toLocaleString('en-IN')}`);
    doc.text(`Total Coupon Deductions: Rs. ${kpi.totalCouponDeductions.toLocaleString('en-IN')}`);
    doc.moveDown(2);

    // For building the Table Data
    const tableData = orders.map(order => [
        order.orderId,
        order.customerName,
        `Rs. ${order.grandTotal.toLocaleString('en-IN')}`,
        `Rs. ${order.discount.toLocaleString('en-IN')}`,
        order.paymentMethod,
        new Date(order.createdAt).toLocaleDateString('en-IN')
    ]);

    // For defining the Table Structure
    const table = {
        title: "Detailed Order History",
        headers: ["Order ID", "Customer", "Amount", "Discount", "Payment", "Date"],
        rows: tableData.length > 0 ? tableData : [["No sales found for this period", "", "", "", "", ""]]
    };

    // For drawing the Table
    await doc.table(table, {
        prepareHeader: () => doc.font("Helvetica-Bold").fontSize(8),
        prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
            doc.font("Helvetica").fontSize(8);
        }
    });

    // Finalizing the PDF
    doc.end();

    // For returning the stream so the controller can pipe it
    return doc;
};

module.exports = {
    getSalesReportData,
    getSalesOverviewStats,
    generatePdfReport
};