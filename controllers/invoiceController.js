const invoiceService = require('../services/invoiceService');

const downloadInvoice = async (req, res) => {
    try {
      const result = await invoiceService.getUserInvoice({ orderId: req.params.id, userId: req.session.userId });
      if (!result) return res.status(404).send('Order not found');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Invoice-${result.order.orderId}.pdf`);
      return res.send(result.pdf);

    } catch (error) {
        console.error('Invoice Generation Error:', error);
        res.status(500).send('Error generating invoice PDF');
    }
};

const downloadAdminInvoice = async (req, res) => {
    if (!req.session.adminId) return res.status(401).send('Admin authentication required');

    try {
      const result = await invoiceService.getAdminInvoice(req.params.id);
      if (!result) return res.status(404).send('Order not found');
        const disposition = req.query.preview === '1' ? 'inline' : 'attachment';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `${disposition}; filename=Invoice-${result.order.orderId}.pdf`);
      return res.send(result.pdf);
    } catch (error) {
        console.error('Admin invoice generation error:', error);
        if (!res.headersSent) res.status(500).send('Error generating invoice PDF');
    }
};

module.exports = { 
  downloadInvoice, 
  downloadAdminInvoice 
};