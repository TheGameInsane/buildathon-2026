import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { fetchCompanyProfile, saveCompanyProfile } from "@/api/org"

const companyProfileQueryKey = ["org", "company-profile"] as const

export function useCompanyProfile() {
  return useQuery({ queryKey: companyProfileQueryKey, queryFn: fetchCompanyProfile })
}

/** Settings > Company Profile's Save — also invalidates preflight for every campaign,
 * since `company_profile_set` reads this row (backend/api/campaigns.py's `_preflight`). */
export function useSaveCompanyProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveCompanyProfile,
    onSuccess: (profile) => {
      queryClient.setQueryData(companyProfileQueryKey, profile)
      queryClient.invalidateQueries({ queryKey: ["campaigns"] })
      toast.success("Company profile saved.")
    },
    onError: () => toast.error("Could not save the company profile. Please try again."),
  })
}
