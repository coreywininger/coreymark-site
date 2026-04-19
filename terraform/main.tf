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
