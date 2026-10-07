const couponService = require('../services/couponService');
const Coupon = require('../models/couponModel');

// For apllying coupon
const applyCoupon = async (req, res) => {
    try{
        const userId =req.session.userId;
        const { couponCode } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to apply coupons.'});
        }
        if (req.session.appliedCoupon) {
            return res.status(409).json({
                success: false,
                message: 'A coupon is already applied. Remove it before applying another.'
            });
        }

        const result = await couponService.applyCoupon(userId, couponCode);

        if (result.success) {
        // Save coupon state in the user's session
        req.session.appliedCoupon = {
            id: result.couponId,
            code: result.couponCode,
            name: result.couponName,
            discountAmount: result.discountAmount
        };
        return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error applying coupon:',error);
        res.status(500).json({ success: false, message: 'Server Error'});
    }
};

// For removing coupon
const removeCoupon = async (req, res) => {
    try{
        if (req.session.appliedCoupon) {
            delete req.session.appliedCoupon;
        }
        res.status(200).json({ success: true, message: 'Coupon removed successfully.'});
    }catch(error) {
        console.error('Error in removing coupon:',error);
        res.status(500).json({ success: false, message: 'Server Error'});
    }
};

// For renderring coupon management page (admin side)
const getCoupons = async (req, res) => {
    try{
        if (!req.session.adminId) return res.redirect('/admin/login');

        const limit = 5;
        const requestedPage = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const searchQuery = String(req.query.search || '').trim();
        const typeFilter = ['percentage', 'fixed'].includes(req.query.type) ? req.query.type : 'all';
        const statusFilter = ['active', 'inactive', 'expired'].includes(req.query.status) ? req.query.status : 'all';
        const filter = {};
        const now = new Date();

        if (searchQuery) {
            const escapedSearch = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.$or = [
                { couponCode: { $regex: escapedSearch, $options: 'i' } },
                { couponName: { $regex: escapedSearch, $options: 'i' } }
            ];
        }
        if (typeFilter !== 'all') filter.discountType = typeFilter;
        if (statusFilter === 'active') Object.assign(filter, { isActive: true, expiryDate: { $gte: now } });
        if (statusFilter === 'inactive') Object.assign(filter, { isActive: false, expiryDate: { $gte: now } });
        if (statusFilter === 'expired') filter.expiryDate = { $lt: now };

        const [totalCoupons, activeCouponCount, expiredCouponCount, totalFilteredCoupons] = await Promise.all([
            Coupon.countDocuments(),
            Coupon.countDocuments({ isActive: true, expiryDate: { $gte: now } }),
            Coupon.countDocuments({ expiryDate: { $lt: now } }),
            Coupon.countDocuments(filter)
        ]);
        const totalPages = Math.ceil(totalFilteredCoupons / limit);
        const page = Math.min(requestedPage, Math.max(totalPages, 1));
        const coupons = await Coupon.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.render('admin/coupons', {
            coupons,
            page,
            limit,
            totalPages,
            totalCoupons,
            totalFilteredCoupons,
            activeCouponCount,
            expiredCouponCount,
            searchQuery,
            typeFilter,
            statusFilter,
            currentPage: 'coupons'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
};

// For creating a new coupon
const createCoupon = async (req,res) => {
    try{
        const { couponCode } = req.body;

        // For validating if coupon code already exist
        const existingCoupon = await Coupon.findOne({ couponCode: couponCode.toUpperCase() });
        if(existingCoupon){
            return res.status(400).json({ message: 'Coupon code already exist.' });
        }

        const newCoupon = new Coupon(req.body);
        await newCoupon.save();

        res.status(201).json({ message: 'Coupon created successfully'});
    }catch(error) {
        console.error(error);
        res.status(500).json({ message:'Error creating coupon'});
    }
};

// For updating a coupon
const updateCoupon = async (req, res) => {
    try{
        const { id } = req.params;
        const { couponCode } = req.body;

        // For ensuring updated code doesn't conflict with another
        const existingCoupon = await Coupon.findOne({
            couponCode: couponCode.toUpperCase(),
            _id: { $ne: id }
        });

        if (existingCoupon) {
            return res.status(400).json({ message:'Coupon code already exist'});
        }

        await Coupon.findByIdAndUpdate(id, req.body, { new: true});
        res.status(200).json({ message: 'Coupon update successfully'});
    }catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error in updating coupon' });
    }
};

// For deleting coupon
const deleteCoupon = async (req, res) => {
    try{
        const { id } = req.params;
        await Coupon.findByIdAndDelete(id);
        res.status(200).json({ message: 'Coupon deleted successfully'});
    }catch(error) {
        console.error(error);
        res.status(500).json({ message: 'Error in deleting coupon'});
    }
};
module.exports = {
    applyCoupon,
    removeCoupon,
    getCoupons,
    createCoupon,
    updateCoupon,
    deleteCoupon
};