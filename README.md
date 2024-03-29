# shell-trade-functions

shell trade functions

## Preparation

1. Check environment files in `.env.project-id`

2. Create a Secret Manager and add a secret version

   ```bash
   gcloud secrets create MORALIS_API_KEY \
     --replication-policy="automatic"
   gcloud secrets versions add MORALIS_API_KEY --data-file="/path/to/file.txt"
   ```

3. Create firestore native databases

   ```bash
   gcloud alpha firestore databases create \
     --database=shell-trade \
     --location=eur3 \
     --type=firestore-native \
     --delete-protection
   gcloud alpha firestore databases create \
     --database=shell-trade \
     --location=eur3 \
     --type=firestore-native \
     --delete-protection
   ```

## Deployment

1. deploy all functions

   ```bash
   firebase deploy --only functions
   ```

   or deploy functions by name

   ```bash
   firebase deploy --project <alias_or_project_id> --only functions:<codebase>
   ```

## References

- [Create a secret - Secret Manager](https://cloud.google.com/secret-manager/docs/creating-and-accessing-secrets)

- [Add a secret version - Secret Manager](https://cloud.google.com/secret-manager/docs/add-secret-version)

- [Manage databases - Firestore](https://cloud.google.com/firestore/docs/manage-databases)

- [Manage functions - Firebase](https://firebase.google.com/docs/functions/manage-functions?gen=2nd)

- [Configure your environment - Firebase](https://firebase.google.com/docs/functions/config-env?gen=2nd)

- [Stream Blockchain Events to Firestore](https://github.com/MoralisWeb3/firebase-extensions/tree/main/streams)

- [Use TypeScript for Cloud Functions - Firebase](https://firebase.google.com/docs/functions/typescript)
