package com.exprivia.deskbooking.service;

import com.exprivia.deskbooking.dto.LayoutAssetDtos;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class LayoutAssetService {

    private final ObjectMapper objectMapper;
    private final Path storageDir;

    public LayoutAssetService(ObjectMapper objectMapper,
                              @Value("${app.layout.storage-dir:./storage/layout}") String storageDir) {
        this.objectMapper = objectMapper;
        this.storageDir = Paths.get(storageDir).toAbsolutePath().normalize();
    }

    public synchronized void saveLayoutAsset(MultipartFile file, String metadataJson) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File planimetria mancante");
        }
        if (metadataJson == null || metadataJson.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Metadata planimetria mancante");
        }

        LayoutAssetDtos.LayoutMetadataRequest metadata;
        try {
            metadata = objectMapper.readValue(metadataJson, LayoutAssetDtos.LayoutMetadataRequest.class);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Metadata planimetria non valido");
        }

        String layoutId = "layout-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 8);
        String originalName = file.getOriginalFilename() == null ? "layout.svg" : file.getOriginalFilename();
        String ext = extractExtension(originalName);
        String contentType = file.getContentType();

        try {
            Files.createDirectories(storageDir);
            Path layoutsDir = storageDir.resolve("layouts");
            Files.createDirectories(layoutsDir);

            LayoutIndex index = readIndex();

            Path layoutDir = layoutsDir.resolve(layoutId);
            Files.createDirectories(layoutDir);

            String imageFilename = "image" + ext;
            Path imagePath = layoutDir.resolve(imageFilename);
            Files.copy(file.getInputStream(), imagePath, StandardCopyOption.REPLACE_EXISTING);

            LayoutFileModel model = new LayoutFileModel();
            model.layoutId = layoutId;
            model.sourceWidth = metadata.sourceWidth() == null ? 816 : metadata.sourceWidth();
            model.sourceHeight = metadata.sourceHeight() == null ? 1056 : metadata.sourceHeight();
            model.roomAnchors = metadata.roomAnchors() == null ? new ArrayList<>() : metadata.roomAnchors();
            model.deskAnchors = metadata.deskAnchors() == null ? new ArrayList<>() : metadata.deskAnchors();
            model.imageFilename = imageFilename;
            model.imageContentType = (contentType == null || contentType.isBlank()) ? "application/octet-stream" : contentType;
            model.filename = originalName;
            model.createdAt = LocalDateTime.now().toString();
            model.version = UUID.randomUUID().toString();

            objectMapper.writeValue(layoutDir.resolve("metadata.json").toFile(), model);

            LayoutIndexItem item = new LayoutIndexItem();
            item.id = layoutId;
            item.filename = originalName;
            item.createdAt = model.createdAt;
            item.sourceWidth = model.sourceWidth;
            item.sourceHeight = model.sourceHeight;

            index.items.removeIf(existing -> existing.id.equals(layoutId));
            index.items.add(item);
            index.activeId = layoutId;
            writeIndex(index);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Impossibile salvare la planimetria");
        }
    }

    public synchronized Optional<LayoutAssetDtos.LayoutMetadataResponse> getLayoutMetadata() {
        Optional<LayoutFileModel> modelOpt = readActiveLayoutModel();
        if (modelOpt.isEmpty()) {
            return Optional.empty();
        }

        LayoutFileModel model = modelOpt.get();
        String imageUrl = "/api/rooms/layout/image?layoutId=" + model.layoutId + "&v=" + model.version;
        return Optional.of(new LayoutAssetDtos.LayoutMetadataResponse(
                model.layoutId,
                model.sourceWidth,
                model.sourceHeight,
                model.roomAnchors,
                model.deskAnchors,
                imageUrl
        ));
    }

    public synchronized Optional<LayoutImagePayload> getLayoutImage(String layoutId) {
        Optional<LayoutFileModel> modelOpt = (layoutId == null || layoutId.isBlank())
                ? readActiveLayoutModel()
                : readLayoutModel(layoutId);
        if (modelOpt.isEmpty()) {
            return Optional.empty();
        }

        LayoutFileModel model = modelOpt.get();
        try {
            Path imagePath = storageDir.resolve("layouts").resolve(model.layoutId).resolve(model.imageFilename);
            if (!Files.exists(imagePath)) {
                return Optional.empty();
            }
            byte[] bytes = Files.readAllBytes(imagePath);
            return Optional.of(new LayoutImagePayload(bytes, model.imageContentType));
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Impossibile leggere immagine planimetria");
        }
    }

    public synchronized List<LayoutAssetDtos.LayoutAdminItem> listLayouts() {
        LayoutIndex index = readIndex();
        return index.items.stream()
                .sorted(Comparator.comparing((LayoutIndexItem item) -> item.createdAt, Comparator.nullsLast(Comparator.naturalOrder())).reversed())
                .map(item -> new LayoutAssetDtos.LayoutAdminItem(
                        item.id,
                        item.filename,
                        item.createdAt,
                        item.id.equals(index.activeId),
                        item.sourceWidth,
                        item.sourceHeight
                ))
                .toList();
    }

    public synchronized void activateLayout(String layoutId) {
        LayoutIndex index = readIndex();
        boolean exists = index.items.stream().anyMatch(item -> item.id.equals(layoutId));
        if (!exists) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Layout non trovato");
        }
        index.activeId = layoutId;
        writeIndex(index);
    }

    public synchronized void deleteLayout(String layoutId) {
        LayoutIndex index = readIndex();
        boolean exists = index.items.stream().anyMatch(item -> item.id.equals(layoutId));
        if (!exists) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Layout non trovato");
        }

        try {
            Path layoutDir = storageDir.resolve("layouts").resolve(layoutId);
            deleteDirectoryRecursively(layoutDir);

            index.items.removeIf(item -> item.id.equals(layoutId));
            if (layoutId.equals(index.activeId)) {
                index.activeId = index.items.isEmpty() ? null : index.items.stream()
                        .max(Comparator.comparing(item -> item.createdAt, Comparator.nullsLast(Comparator.naturalOrder())))
                        .map(item -> item.id)
                        .orElse(null);
            }
            writeIndex(index);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Impossibile eliminare la planimetria");
        }
    }

    private Optional<LayoutFileModel> readActiveLayoutModel() {
        LayoutIndex index = readIndex();
        if (index.activeId == null || index.activeId.isBlank()) {
            return Optional.empty();
        }
        return readLayoutModel(index.activeId);
    }

    private Optional<LayoutFileModel> readLayoutModel(String layoutId) {
        try {
            Path metadataPath = storageDir.resolve("layouts").resolve(layoutId).resolve("metadata.json");
            if (!Files.exists(metadataPath)) {
                return Optional.empty();
            }
            LayoutFileModel model = objectMapper.readValue(metadataPath.toFile(), LayoutFileModel.class);
            if (model.layoutId == null || model.layoutId.isBlank()) {
                model.layoutId = layoutId;
            }
            return Optional.of(model);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Impossibile leggere metadata planimetria");
        }
    }

    private LayoutIndex readIndex() {
        try {
            Path indexPath = storageDir.resolve("index.json");
            if (!Files.exists(indexPath)) {
                return new LayoutIndex();
            }
            LayoutIndex index = objectMapper.readValue(indexPath.toFile(), LayoutIndex.class);
            if (index.items == null) {
                index.items = new ArrayList<>();
            }
            return index;
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Impossibile leggere indice planimetrie");
        }
    }

    private void writeIndex(LayoutIndex index) {
        try {
            Files.createDirectories(storageDir);
            objectMapper.writeValue(storageDir.resolve("index.json").toFile(), index);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Impossibile salvare indice planimetrie");
        }
    }

    private void deleteDirectoryRecursively(Path dir) throws IOException {
        if (!Files.exists(dir)) {
            return;
        }
        try (var paths = Files.walk(dir)) {
            paths.sorted(Comparator.reverseOrder())
                    .forEach(path -> {
                        try {
                            Files.deleteIfExists(path);
                        } catch (IOException ex) {
                            throw new RuntimeException(ex);
                        }
                    });
        } catch (RuntimeException ex) {
            if (ex.getCause() instanceof IOException ioEx) {
                throw ioEx;
            }
            throw ex;
        }
    }

    private String extractExtension(String filename) {
        int idx = filename.lastIndexOf('.');
        if (idx <= -1 || idx == filename.length() - 1) {
            return ".svg";
        }
        return filename.substring(idx).toLowerCase();
    }

    public record LayoutImagePayload(byte[] bytes, String contentType) {
    }

    private static class LayoutIndex {
        public String activeId;
        public List<LayoutIndexItem> items = new ArrayList<>();
    }

    private static class LayoutIndexItem {
        public String id;
        public String filename;
        public String createdAt;
        public Integer sourceWidth;
        public Integer sourceHeight;
    }

    private static class LayoutFileModel {
        public String layoutId;
        public Integer sourceWidth;
        public Integer sourceHeight;
        public List<LayoutAssetDtos.RoomAnchor> roomAnchors;
        public List<LayoutAssetDtos.DeskAnchor> deskAnchors;
        public String imageFilename;
        public String imageContentType;
        public String filename;
        public String createdAt;
        public String version;
    }
}
