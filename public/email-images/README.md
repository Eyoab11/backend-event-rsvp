# Email Images Directory

This directory contains images used in email templates.

## Images Required

Place the following images in this directory:

1. **mask-group.png** - Hero image for emails (main event image)
2. **lemm.png** - Company logo
3. **calendar.png** - Calendar icon (16x16 or 32x32)
4. **clock.png** - Clock icon (16x16 or 32x32)
5. **location.png** - Location pin icon (16x16 or 32x32)
6. **bow.png** - Dress code/bow tie icon (16x16 or 32x32)

## Download from ImgBB

Run these commands to download the current images:

```bash
cd backend-event-rsvp/public/email-images

# Download hero image
curl -o mask-group.png "https://i.ibb.co/XZJHXcCp/mask-group.png"

# Download logo
curl -o lemm.png "https://i.ibb.co/HpRR250c/lemm.png"

# Download icons
curl -o calendar.png "https://i.ibb.co/qYVNy2F9/calendar.png"
curl -o clock.png "https://i.ibb.co/vxNCHPp7/clock.png"
curl -o location.png "https://i.ibb.co/S4q77qPS/location.png"
curl -o bow.png "https://i.ibb.co/RkXwWsHv/bow.png"
```

## Access URLs

After placing images here and deploying, they will be accessible at:

**Local Development:**
- http://localhost:3002/static/email-images/mask-group.png
- http://localhost:3002/static/email-images/lemm.png
- http://localhost:3002/static/email-images/calendar.png
- http://localhost:3002/static/email-images/clock.png
- http://localhost:3002/static/email-images/location.png
- http://localhost:3002/static/email-images/bow.png

**Production:**
- https://api.levyeromomedia.com/static/email-images/mask-group.png
- https://api.levyeromomedia.com/static/email-images/lemm.png
- https://api.levyeromomedia.com/static/email-images/calendar.png
- https://api.levyeromomedia.com/static/email-images/clock.png
- https://api.levyeromomedia.com/static/email-images/location.png
- https://api.levyeromomedia.com/static/email-images/bow.png

## Environment Variables

Update your `.env` file to use these URLs:

```env
EMAIL_HERO_IMAGE_URL="https://api.levyeromomedia.com/static/email-images/mask-group.png"
EMAIL_LOGO_URL="https://api.levyeromomedia.com/static/email-images/lemm.png"
EMAIL_CALENDAR_ICON_URL="https://api.levyeromomedia.com/static/email-images/calendar.png"
EMAIL_CLOCK_ICON_URL="https://api.levyeromomedia.com/static/email-images/clock.png"
EMAIL_LOCATION_ICON_URL="https://api.levyeromomedia.com/static/email-images/location.png"
EMAIL_BOW_ICON_URL="https://api.levyeromomedia.com/static/email-images/bow.png"
```

## Image Optimization

Before deploying, optimize images for email:

```bash
# Install imagemagick if needed
brew install imagemagick  # Mac
sudo apt install imagemagick  # Linux

# Optimize hero image (keep quality high)
convert mask-group.png -quality 85 -strip mask-group-optimized.png
mv mask-group-optimized.png mask-group.png

# Optimize logo
convert lemm.png -quality 85 -strip lemm-optimized.png
mv lemm-optimized.png lemm.png

# Optimize and resize icons to 32x32
convert calendar.png -resize 32x32 -quality 85 -strip calendar-optimized.png
mv calendar-optimized.png calendar.png

convert clock.png -resize 32x32 -quality 85 -strip clock-optimized.png
mv clock-optimized.png clock.png

convert location.png -resize 32x32 -quality 85 -strip location-optimized.png
mv location-optimized.png location.png

convert bow.png -resize 32x32 -quality 85 -strip bow-optimized.png
mv bow-optimized.png bow.png
```

## Git

This directory should be committed to git (images included) so they're deployed with your app.

Make sure `public/` is NOT in `.gitignore`.

## Testing

After adding images, test locally:

```bash
# Start the backend
npm run start:dev

# Test image access
curl -I http://localhost:3002/static/email-images/mask-group.png
# Should return: HTTP/1.1 200 OK

# Test in browser
open http://localhost:3002/static/email-images/mask-group.png
```

## Deployment

When deploying to DigitalOcean:

1. Images in `public/` directory will be included in the build
2. Update environment variables on DigitalOcean
3. Redeploy the app
4. Test image URLs in production

## Notes

- Images must be publicly accessible (no authentication required)
- Use HTTPS in production for email client compatibility
- Keep images optimized for fast email loading
- Consider using a CDN for better performance (optional)
