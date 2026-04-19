provider "azurerm" {
  subscription_id = var.subscription_id
  tenant_id       = var.tenant_id

  features {}
}

locals {
  common_tags = {
    project     = "coreymark-site"
    environment = var.environment
    iac         = "terraform"
    repo        = var.repo_url
  }
}

resource "azurerm_resource_group" "main" {
  name     = "rg-coreymark-${var.environment}"
  location = var.location

  tags = local.common_tags
}

resource "azurerm_static_web_app" "main" {
  name                = "swa-coreymark-${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  sku_tier = "Free"
  sku_size = "Free"

  tags = local.common_tags
}

# Custom domains — apex validates via TXT at the apex itself (@), www
# via CNAME delegation. Apex must be applied first so its
# validation_token is available for the TXT record; www validates the
# moment its CNAME resolves to the ASWA default hostname.
#
# The TXT record goes at @ (apex), NOT asuid.<apex> — ASWA uses a
# different validation location than Azure App Service. Symptom of
# putting it at asuid: status stuck at "Validating" with null
# errorMessage (Azure never finds a candidate record).
#
# "Set as default domain" (for www → apex 301 redirect) is a portal-only
# click — not exposed by the azurerm provider. See terraform/README.md.
resource "azurerm_static_web_app_custom_domain" "apex" {
  static_web_app_id = azurerm_static_web_app.main.id
  domain_name       = "coreymark.com"
  validation_type   = "dns-txt-token"
}

resource "azurerm_static_web_app_custom_domain" "www" {
  static_web_app_id = azurerm_static_web_app.main.id
  domain_name       = "www.coreymark.com"
  validation_type   = "cname-delegation"
}
