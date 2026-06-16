#!/bin/bash
set -e

# Configuration
SERVICE_NAME="tiny-ai-assistant"
REGION="us-central1"
BUCKET_NAME="tiny-ai-knowledge-base"

# Verify active project
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
  echo "Error: No active GCP project configured. Run 'gcloud config set project [PROJECT_ID]' first."
  exit 1
fi

IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "=========================================="
echo "Deploying $SERVICE_NAME to Google Cloud Run"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Bucket: $BUCKET_NAME"
echo "=========================================="

# 1. Build and push container image using Cloud Builds
echo "⚡ Building and submitting container image..."
gcloud builds submit --tag "$IMAGE_NAME" .

# 2. Deploy service on Cloud Run with mounted GCS Bucket
# Using type=cloud-storage volume mount and stat-cache-ttl=0 for instant write propagation
echo "🚀 Deploying to Cloud Run..."
gcloud beta run deploy "$SERVICE_NAME" \
  --image "$IMAGE_NAME" \
  --region "$REGION" \
  --execution-environment=gen2 \
  --add-volume="name=knowledge-vol,type=cloud-storage,bucket=$BUCKET_NAME,mount-options=stat-cache-ttl=0" \
  --add-volume-mount="volume=knowledge-vol,mount-path=/app/knowledge" \
  --allow-unauthenticated

echo "✓ Deployment complete!"
