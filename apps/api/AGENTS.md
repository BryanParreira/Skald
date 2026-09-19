```bash
infisical export \
  --env=dev \
  --secret-overriding=false \
  --format=dotenv \
  --output-file="apps/api/.env" \
  --projectId=87dad7b5-72a6-4791-9228-b3b86b169db1 \
  --path="/skald/ai"
```

`/skald/ai` is the API runtime view. Its Nango entries should reference the
source secrets in `/skald/nango` rather than requiring API jobs to export a
second secret path.
