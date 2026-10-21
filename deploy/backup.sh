#!/usr/bin/env sh
# PostgreSQL backup of the production compose (home-search-production/TD-09): a compressed custom
# format dump of the `db` service, uploaded to the bucket under the private BACKUP_PREFIX (the public
# policy covers thumbnails/* only) with the date in the name, and pruned after BACKUP_RETENTION_DAYS.
#
#   deploy/backup.sh                       # from the repo root on the VPS (reads deploy/.env)
#   crontab: 30 3 * * * cd /srv/streamtube && deploy/backup.sh >> /var/log/streamtube-backup.log 2>&1
#
# Restore: aws s3 cp s3://$S3_BUCKET/backups/<file> . && \
#   docker compose -f deploy/compose.yaml exec -T db pg_restore -U "$DB_USERNAME" -d "$DB_NAME" --clean --if-exists < <file>
#
# Extra compose files (e.g. the local validation override) can be passed in COMPOSE_FILES, and
# BACKUP_S3_ENDPOINT overrides S3_ENDPOINT (e.g. http://rustfs:9000 in the local validation).
set -eu

cd "$(dirname "$0")/.."
ENV_FILE=deploy/.env
[ -f "$ENV_FILE" ] || { echo "backup: $ENV_FILE not found" >&2; exit 1; }
set -a
# shellcheck disable=SC1090
. "./$ENV_FILE"
set +a

COMPOSE="docker compose -f deploy/compose.yaml ${COMPOSE_FILES:-} --env-file $ENV_FILE"
PREFIX="${BACKUP_PREFIX:-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
FILE="streamtube-${STAMP}.dump"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

# -Fc: compressed custom format, restorable with pg_restore (and listable with pg_restore --list).
$COMPOSE exec -T db pg_dump -U "$DB_USERNAME" -d "$DB_NAME" -Fc > "$WORKDIR/$FILE"
[ -s "$WORKDIR/$FILE" ] || { echo "backup: empty dump" >&2; exit 1; }

# The aws-cli runs in a throwaway container on the compose network, so S3_ENDPOINT may be internal.
ENDPOINT="${BACKUP_S3_ENDPOINT:-$S3_ENDPOINT}"
aws() {
  docker run --rm -i --network streamtube_internal \
    -e AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" -e AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" \
    -e AWS_DEFAULT_REGION="${S3_REGION:-us-east-1}" -e AWS_EC2_METADATA_DISABLED=true \
    -e AWS_REQUEST_CHECKSUM_CALCULATION=when_required -e AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
    amazon/aws-cli:2.38.1 --endpoint-url "$ENDPOINT" "$@"
}

# No bind mount: the dump goes in through stdin, so the script does not depend on host paths.
aws s3 cp - "s3://$S3_BUCKET/$PREFIX/$FILE" --only-show-errors < "$WORKDIR/$FILE"
echo "backup: uploaded s3://$S3_BUCKET/$PREFIX/$FILE"

# Retention by the date in the name (no lifecycle rule needed on the provider).
CUTOFF="$(date -u -d "-${RETENTION_DAYS} days" +%Y-%m-%d 2>/dev/null || date -u -v-"${RETENTION_DAYS}"d +%Y-%m-%d)"
aws s3 ls "s3://$S3_BUCKET/$PREFIX/" < /dev/null | awk '{print $4}' | while read -r name; do
  day="$(echo "$name" | sed -n 's/^streamtube-\([0-9-]\{10\}\)T.*\.dump$/\1/p')"
  if [ -n "$day" ] && [ "$day" \< "$CUTOFF" ]; then
    aws s3 rm "s3://$S3_BUCKET/$PREFIX/$name" --only-show-errors < /dev/null
    echo "backup: removed $name (older than $RETENTION_DAYS days)"
  fi
done
