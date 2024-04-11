#!/usr/bin/env sh
set -e

# This script tests whether self-hosting the Dolos web-app works using the docker-compose.yml

docker-compose down
docker-compose pull
docker pull ghcr.io/dodona-edu/dolos-cli:latest
docker-compose up --wait --detach

echo "Upload zipfile"

upload_response="$(
  curl -s --fail \
    --form "dataset[name]=Example" \
    --form "dataset[zipfile]=@./samples/javascript/simple-dataset.zip" \
    http://localhost:3000/reports
    )"

report_url="$(echo "$upload_response" | jq -r '.url')"

echo "Polling $report_url until finished or failed"

while sleep 1; do
  report_json="$(curl -s --fail "$report_url")"
  report_status="$(echo "$report_json" | jq -r '.status')"
  echo "Status is '$report_status'"
  case "$report_status" in
    "queued" | "running")
      ;;
    "finished")
      break
      ;;
    *)
      echo "Something went wrong:"
      echo "$report_json"
      exit 1
      ;;
  esac
done

curl -s --location --fail "$report_url/data/pairs.csv"

echo "Everything is working as expected"

docker-compose down
