package com.exprivia.deskbooking.controller;

import com.exprivia.deskbooking.dto.admin.AdminUserDtos;
import com.exprivia.deskbooking.dto.LayoutAssetDtos;
import com.exprivia.deskbooking.dto.admin.LayoutImportDtos;
import com.exprivia.deskbooking.service.AuthService;
import com.exprivia.deskbooking.service.LayoutAssetService;
import com.exprivia.deskbooking.service.LayoutImportService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final LayoutImportService layoutImportService;
    private final LayoutAssetService layoutAssetService;
    private final AuthService authService;

    public AdminController(LayoutImportService layoutImportService,
                           LayoutAssetService layoutAssetService,
                           AuthService authService) {
        this.layoutImportService = layoutImportService;
        this.layoutAssetService = layoutAssetService;
        this.authService = authService;
    }

    @PostMapping("/layout/import")
    public Map<String, Object> importLayout(@Valid @RequestBody LayoutImportDtos.LayoutImportRequest request) {
        return layoutImportService.importLayout(request);
    }

    @PostMapping(value = "/layout/asset", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void uploadLayoutAsset(@RequestPart("file") MultipartFile file,
                                  @RequestPart("metadata") String metadataJson) {
        layoutAssetService.saveLayoutAsset(file, metadataJson);
    }

    @GetMapping("/layouts")
    public List<LayoutAssetDtos.LayoutAdminItem> listLayouts() {
        return layoutAssetService.listLayouts();
    }

    @PostMapping("/layouts/{layoutId}/activate")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void activateLayout(@PathVariable String layoutId) {
        layoutAssetService.activateLayout(layoutId);
    }

    @DeleteMapping("/layouts/{layoutId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteLayout(@PathVariable String layoutId) {
        layoutAssetService.deleteLayout(layoutId);
    }

    @PostMapping("/users")
    public AdminUserDtos.EmployeeResponse createEmployee(@Valid @RequestBody AdminUserDtos.CreateEmployeeRequest request) {
        return authService.createEmployee(request);
    }
}
