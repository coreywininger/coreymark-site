# Terraform — coreymark.com

Provisions the Azure resources for coreymark.com:

- Resource group `rg-coreymark-prod`
- Azure Static Web App `swa-coreymark-prod` (Free tier) in `centralus`

State lives locally (`terraform/terraform.tfstate`) — low-stakes personal
project. Migrate to an Azure Storage backend later only if warranted.

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/downloads) `>= 1.9.0`
  (`brew install terraform` or `brew install opentofu` + set `alias
  terraform=tofu`)
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
  (`brew install azure-cli`)

## The tenant gotcha — read this first

Corey's Azure subscription for coreymark.com lives in the
**coreymark.com** directory (tenant `xguruhotmail.onmicrosoft.com`), NOT
the default `home` directory. A plain `az login` will drop you in the
wrong tenant and Terraform will either fail or — worse — provision into
the wrong subscription.

**Always specify the tenant:**

```bash
az login --tenant xguruhotmail.onmicrosoft.com
az account set --subscription "<coreymark subscription name or id>"
az account show    # confirm tenant + subscription are what you expect
```

If you have multiple subscriptions in that tenant, pick the right one
with `az account set` before running Terraform.

## First-time setup

```bash
cd terraform
terraform init
```

## Apply

```bash
terraform plan -out=tfplan
terraform apply tfplan
```

With the default variables this creates `rg-coreymark-prod` and
`swa-coreymark-prod`. No inputs are required at the prompt — the
provider uses the tenant/subscription active in `az login` unless you
override them in `terraform.tfvars`.

To pin values, copy the example and fill it in:

```bash
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars, then:
terraform apply
```

`terraform.tfvars` is gitignored.

## Retrieving the deployment token

The ASWA deployment token is a sensitive output. Pull it with:

```bash
terraform output -raw api_key
```

Then add it as a GitHub secret on the repo:

```bash
gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN \
  --repo coreywininger/coreymark-site \
  --body "$(terraform output -raw api_key)"
```

Or via the GitHub UI: repo → Settings → Secrets and variables → Actions
→ New repository secret.

## Outputs

| Name                  | Description                                               |
| --------------------- | --------------------------------------------------------- |
| `resource_group_name` | Resource group name                                       |
| `static_web_app_name` | ASWA resource name                                        |
| `default_hostname`    | `<random>-<hash>.<region>.azurestaticapps.net` default URL |
| `api_key`             | Deployment token (sensitive — use `-raw` to read)         |

## Linking the GitHub repo

Terraform provisions the ASWA without a repo link. After apply, link the
repo in the Azure portal:

1. Portal → Static Web Apps → `swa-coreymark-prod` → **Deployment** → **Manage deployment token** (to verify), then **Overview** → **Set up deployment source**
2. Choose GitHub, authorize, pick `coreywininger/coreymark-site`, branch `main`
3. Azure commits a workflow file (`.github/workflows/azure-static-web-apps-*.yml`) to the repo
4. First push to `main` triggers the workflow and deploys

Alternatively, skip the portal linking and bring your own workflow —
just make sure `AZURE_STATIC_WEB_APPS_API_TOKEN` is set as a repo
secret.

## Destroying

```bash
terraform destroy
```

This drops both resources. The deployment token becomes invalid the
moment the ASWA is destroyed — remove or rotate the GitHub secret after.
