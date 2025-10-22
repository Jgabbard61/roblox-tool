# Customer Logo Upload Specifications

## 📏 Optimal Image Resolution

### Recommended Dimensions
- **Height:** 192 pixels
- **Width:** 400-600 pixels (depending on your logo's aspect ratio)
- **Aspect Ratio:** 2:1 to 4:1 (landscape format)

### Why These Dimensions?

1. **Display Size:** Your logo is displayed at 64px height on the main search page
2. **Retina/High-DPI Support:** 192px provides 3× resolution for crisp display on high-DPI screens
3. **Admin Preview:** The admin panel preview shows logos at 192px height, so your logo will look exactly as intended
4. **Quality:** This resolution ensures sharp, professional appearance across all devices

## 🎨 Format Recommendations

### Best Options (in order of preference):

1. **PNG (Recommended for most logos)**
   - Use for logos with transparency
   - Use for logos with solid colors and gradients
   - Supports transparency (important for logos without backgrounds)
   - File size: Typically 50-500KB with optimization

2. **SVG (Best for simple logos)**
   - Perfect for simple, vector-based logos
   - Infinitely scalable without quality loss
   - Smallest file size
   - Not supported by current upload system - convert to PNG first

3. **JPG/JPEG (Only for photo-based logos)**
   - Use only if your logo is a photograph or has complex imagery
   - Cannot have transparent background
   - Slightly smaller file size than PNG

## 📐 Aspect Ratio Examples

| Aspect Ratio | Width (px) | Height (px) | Best For |
|--------------|------------|-------------|----------|
| 2:1          | 384        | 192         | Standard company logos |
| 3:1          | 576        | 192         | Wide horizontal logos |
| 4:1          | 768        | 192         | Very wide banner-style logos |
| 1:1          | 192        | 192         | Square logos or icons |

## 📊 File Size Limits

- **Maximum file size:** 5 MB
- **Recommended file size:** 100-500 KB (use compression tools)
- **Allowed formats:** .jpg, .jpeg, .png, .gif, .bmp

## ✅ Quality Checklist

Before uploading your logo, ensure:

- [ ] Image height is 192px (or at least 128px for 2× support)
- [ ] Image width is between 200-800px (depending on aspect ratio)
- [ ] File size is under 500KB (preferably under 200KB)
- [ ] Format is PNG (if logo needs transparency) or JPG (if not)
- [ ] Image has transparent background (PNG) or white background
- [ ] Logo is clearly visible and not pixelated
- [ ] Colors are accurate and match your brand

## 🛠️ Optimization Tips

1. **Use compression tools:**
   - TinyPNG (https://tinypng.com) - Reduces PNG file size without quality loss
   - Squoosh (https://squoosh.app) - Advanced image optimization
   - ImageOptim (Mac) or RIOT (Windows) - Desktop tools

2. **Export settings:**
   - PNG: 24-bit color depth with alpha channel (transparency)
   - JPG: Quality 85-90% is usually sufficient
   - Remove metadata to reduce file size

3. **Design considerations:**
   - Ensure logo works on both light and dark backgrounds
   - Test logo at small sizes (64px height) to ensure readability
   - Avoid very thin lines or small text (may not be visible at 64px)

## 🎯 Display Behavior

Your logo will be displayed:

- **On main search page:** Centered, 64px height, width auto-adjusted to maintain aspect ratio
- **In admin preview:** Centered, 192px height (maximum), width auto-adjusted
- **Responsive:** Logo will scale down on mobile devices while maintaining aspect ratio

## 📝 Step-by-Step Upload Guide

1. **Prepare your logo:**
   - Export at 192px height
   - Choose appropriate width based on aspect ratio
   - Save as PNG (with transparency) or JPG
   - Optimize file size to under 500KB

2. **Upload in Admin Dashboard:**
   - Go to Admin Dashboard → Customers tab
   - Click "Logo" button for the customer
   - Click "Choose File" and select your logo
   - Preview the logo to ensure it looks correct
   - Click "Upload Logo"

3. **Verify display:**
   - Log in as a customer admin or user
   - Check that logo appears correctly on search page
   - Test on mobile device if possible

## 🐛 Troubleshooting

### Logo looks blurry/pixelated
- ✅ **Solution:** Use higher resolution (192px height minimum)

### Logo is too large or cut off
- ✅ **Solution:** Check aspect ratio - use 2:1 to 4:1 landscape format

### Upload fails: "File too large"
- ✅ **Solution:** Compress image using TinyPNG or similar tool

### Upload fails: "Invalid file type"
- ✅ **Solution:** Ensure file extension is .png, .jpg, .jpeg, .gif, or .bmp

### Logo doesn't appear after upload
- ✅ **Solution:** Refresh the page, check browser console for errors

### Logo has incorrect colors
- ✅ **Solution:** Use sRGB color profile when exporting

## 📞 Need Help?

If you encounter issues with logo upload or display, please contact your system administrator with:
- Screenshot of the issue
- Logo file specifications (dimensions, format, file size)
- Browser and device information

---

**Last Updated:** October 2025  
**Version:** 1.0
