# Deployment Guide for Render

This guide will help you deploy the Options Data Comparison app to Render.

## Prerequisites

1. A GitHub account
2. A Render account (sign up at https://render.com)
3. Your code pushed to a GitHub repository

## Deployment Steps

### Option 1: Using Render Dashboard (Recommended)

1. **Push your code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Create a new Static Site on Render**
   - Go to https://dashboard.render.com
   - Click "New +" and select "Static Site"
   - Connect your GitHub repository
   - Render will auto-detect the settings:
     - **Build Command**: `npm install && npm run build`
     - **Publish Directory**: `dist`
   - Click "Create Static Site"

3. **Wait for deployment**
   - Render will automatically build and deploy your site
   - You'll get a URL like: `https://your-app-name.onrender.com`

### Option 2: Using render.yaml (Automatic)

If you've already created the `render.yaml` file:

1. Push your code to GitHub (including `render.yaml`)
2. In Render dashboard, select "New +" → "Blueprint"
3. Connect your GitHub repository
4. Render will automatically detect and use the `render.yaml` configuration

## Build Configuration

- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`
- **Node Version**: 18.x (or higher)

## Environment Variables

No environment variables are required for this static site.

## Custom Domain (Optional)

1. In your Render dashboard, go to your static site
2. Click on "Settings"
3. Scroll to "Custom Domains"
4. Add your domain and follow the DNS configuration instructions

## Troubleshooting

- **Build fails**: Check the build logs in Render dashboard
- **Site not loading**: Verify the publish directory is set to `dist`
- **Styling issues**: Ensure all CSS files are imported correctly in your React components

## Notes

- Render provides free SSL certificates automatically
- The free tier includes automatic deployments on every push to main branch
- Builds typically take 2-5 minutes

