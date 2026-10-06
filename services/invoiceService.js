const PDFDocument = require('pdfkit');
const Order = require('../models/orderModel');

const formatCurrency = amount => `INR ${Number(amount || 0).toLocaleString('en-IN')}`;

// For generating an invoice PDF
const createInvoicePdf = order => new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).fillColor('#0968ec').text('Fitpro Equips', 50, 50);
    doc.fontSize(10.5).fillColor('#64748b').text('Tax Invoice / Receipt', 50, 75);
    doc.fontSize(10).fillColor('#1e293b')
        .text(`Order ID: #${order.orderId}`, 400, 50, { align: 'right' })
        .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 400, 65, { align: 'right' })
        .text(`Payment: ${order.paymentMethod}`, 400, 80, { align: 'right' });

    doc.moveDown(2);
    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, 110).lineTo(545, 110).stroke();
    doc.fontSize(12).fillColor('#0f172a').text('Shipping Address:', 50, 130);
    doc.fontSize(10).fillColor('#475569')
        .text(order.shippingAddress.name, 50, 150)
        .text(order.shippingAddress.fullAddress, 50, 165)
        .text(`Phone: ${order.shippingAddress.phone}`, 50, 180);

    let y = 230;
    doc.fillColor('#f8fafc').rect(50, y, 495, 20).fill();
    doc.fontSize(10).fillColor('#0f172a').font('Helvetica-Bold')
        .text('Item Description', 60, y + 5)
        .text('Qty', 350, y + 5, { width: 40, align: 'center' })
        .text('Price', 400, y + 5, { width: 60, align: 'right' })
        .text('Total', 470, y + 5, { width: 60, align: 'right' });
    y += 25;
    doc.font('Helvetica');
    order.items.forEach(item => {
        doc.fillColor('#334155')
            .text(item.name, 60, y, { width: 280 })
            .text(item.quantity.toString(), 350, y, { width: 40, align: 'center' })
            .text(formatCurrency(item.price), 400, y, { width: 60, align: 'right' })
            .text(formatCurrency(item.price * item.quantity), 470, y, { width: 60, align: 'right' });
        y += 25;
    });

    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, y + 10).lineTo(545, y + 10).stroke();
    y += 30;
    const rightX = 400;
    doc.fontSize(10).fillColor('#64748b')
        .text('Subtotal:', rightX, y)
        .text(formatCurrency(order.subtotal), 470, y, { align: 'right' });
    y += 18;
    doc.text('GST (18%):', rightX, y)
        .text(formatCurrency(order.tax), 470, y, { align: 'right' });
    y += 18;
    doc.text('Shipping:', rightX, y)
        .text(order.shippingCost === 0 ? 'FREE' : formatCurrency(order.shippingCost), 470, y, { align: 'right' });
    y += 24;
    if (Number(order.discount) > 0) {
        const couponLabel = order.couponCode ? `Coupon Discount (${order.couponCode}):` : 'Coupon Discount:';
        doc.fontSize(10).font('Helvetica').fillColor('#15814b')
            .text(couponLabel, rightX, y, { width: 145 })
            .text(`-${formatCurrency(order.discount)}`, 470, y, { align: 'right' });
        y += doc.heightOfString(couponLabel, { width: 145 }) + 12;
    }
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a')
        .text('Grand Total:', rightX, y)
        .text(formatCurrency(order.grandTotal), 460, y, { width: 80, align: 'right' });
    doc.fontSize(9).font('Helvetica').fillColor('#94a3b8')
        .text('Thank you for shopping with Fitpro Equips! This is a computer-generated invoice.', 50, 730, { align: 'center', width: 495 });
    doc.end();
});

// For fetching a user's invoice
const getUserInvoice = async ({ orderId, userId }) => {
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) return null;
    return { order, pdf: await createInvoicePdf(order) };
};

// For fetching an admin invoice
const getAdminInvoice = async orderId => {
    const order = await Order.findById(orderId);
    if (!order) return null;
    return { order, pdf: await createInvoicePdf(order) };
};

module.exports = { getUserInvoice, getAdminInvoice };
