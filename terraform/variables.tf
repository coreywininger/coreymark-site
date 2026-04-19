variable "subscription_id" {
  description = "Azure subscription ID. Leave null to use the subscription active in `az login`."
  type        = string
  default     = null
}

variable "tenant_id" {
  description = "Azure AD tenant ID. Leave null to use the tenant active in `az login`. See README for the coreymark.com tenant note."
  type        = string
  default     = null
}

variable "location" {
  description = "Azure region for resources. Must be a region that supports Azure Static Web Apps."
  type        = string
  default     = "centralus"

  validation {
    condition = contains(
      ["westus2", "centralus", "eastus2", "westeurope", "eastasia"],
      var.location,
    )
    error_message = "Azure Static Web Apps currently supports: westus2, centralus, eastus2, westeurope, eastasia."
  }
}

variable "repo_url" {
  description = "GitHub repository URL for the site. Stored as a tag; the repo → ASWA linkage itself is established via the portal post-apply."
  type        = string
  default     = "https://github.com/coreywininger/coreymark-site"
}

variable "environment" {
  description = "Environment tag for resources."
  type        = string
  default     = "prod"
}
