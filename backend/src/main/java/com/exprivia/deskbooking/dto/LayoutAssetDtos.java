package com.exprivia.deskbooking.dto;

import java.util.List;

public class LayoutAssetDtos {

    public record RoomAnchor(
            String code,
            double x,
            double y
    ) {
    }

    public record DeskAnchor(
            String roomCode,
            int deskNumber,
            double x,
            double y
    ) {
    }

    public record LayoutMetadataRequest(
            Integer sourceWidth,
            Integer sourceHeight,
            List<RoomAnchor> roomAnchors,
            List<DeskAnchor> deskAnchors
    ) {
    }

    public record LayoutMetadataResponse(
            String layoutId,
            Integer sourceWidth,
            Integer sourceHeight,
            List<RoomAnchor> roomAnchors,
            List<DeskAnchor> deskAnchors,
            String imageUrl
    ) {
    }

    public record LayoutAdminItem(
            String id,
            String filename,
            String createdAt,
            boolean active,
            Integer sourceWidth,
            Integer sourceHeight
    ) {
    }
}
